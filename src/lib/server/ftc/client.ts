import * as z from 'zod';
import { SEASON } from '#lib/game/biobuzz.ts';
import { createBreaker, type Breaker } from '#lib/server/breaker.ts';

export const FTC_API_ROOT = 'https://ftc-api.firstinspires.org/v2.0/';

export type FtcResponse<T> =
	| { status: 'ok'; body: T; lastModified: string | null }
	| { status: 'unchanged'; lastModified: string | null };

export interface FtcRequestOptions {
	ifModifiedSince?: string | null;
	timeoutMs?: number;
}

export interface FtcClientOptions {
	username?: string;
	apiKey?: string;
	season?: number;
	fetch?: typeof fetch;
	timeoutMs?: number;
	budgetMs?: number;
	retries?: number;
	maxRetryWaitMs?: number;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
	breaker?: Breaker;
}

export class FtcApiError extends Error {
	readonly status: number;
	readonly path: string;

	constructor(status: number, path: string, message: string) {
		super(message);
		this.name = 'FtcApiError';
		this.status = status;
		this.path = path;
	}
}

export function isNotFound(error: unknown): boolean {
	return error instanceof FtcApiError && error.status === 404;
}

function describeStatus(status: number): string {
	if (status === 400) return 'FTC API rejected the request';
	if (status === 401 || status === 403) return 'FTC API rejected the credentials';
	if (status === 404) return 'Not found in the FTC API';
	if (status === 429) return 'FTC API rate limit reached';
	if (status >= 500) return 'FTC API is having trouble';
	return `FTC API error ${status}`;
}

function isOutage(status: number): boolean {
	return status === 401 || status === 403 || status === 429 || status >= 500;
}

function isTimeout(error: unknown): boolean {
	return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
	if (!value) return null;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
	const date = Date.parse(value);
	return Number.isNaN(date) ? null : Math.max(0, date - now);
}

function backoff(attempt: number): number {
	return 400 * 2 ** attempt + Math.floor(Math.random() * 200);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createFtcClient(options: FtcClientOptions = {}) {
	const season = options.season ?? SEASON;
	const timeoutMs = options.timeoutMs ?? 4_000;
	const budgetMs = options.budgetMs ?? 6_000;
	const retries = options.retries ?? 2;
	const maxRetryWaitMs = options.maxRetryWaitMs ?? 3_000;
	const sleep = options.sleep ?? defaultSleep;
	const now = options.now ?? Date.now;
	const breaker = options.breaker ?? createBreaker({ now });
	const authorization =
		options.username && options.apiKey
			? `Basic ${btoa(`${options.username}:${options.apiKey}`)}`
			: null;

	async function request(
		path: string,
		init: FtcRequestOptions = {}
	): Promise<FtcResponse<unknown>> {
		if (!authorization) throw new FtcApiError(503, path, 'FTC API credentials are not configured');
		if (!breaker.allow()) throw new FtcApiError(503, path, 'FTC API is paused after errors');
		try {
			const response = await send(path, init, authorization);
			breaker.success();
			return response;
		} catch (error) {
			if (error instanceof FtcApiError && isOutage(error.status)) breaker.failure();
			else breaker.success();
			throw error;
		}
	}

	async function send(
		path: string,
		init: FtcRequestOptions,
		authorization: string
	): Promise<FtcResponse<unknown>> {
		const headers: Record<string, string> = { authorization, accept: 'application/json' };
		if (init.ifModifiedSince) headers['if-modified-since'] = init.ifModifiedSince;
		const url = `${FTC_API_ROOT}${season}/${path}`;
		const started = now();
		const budget = Math.max(budgetMs, init.timeoutMs ?? 0);
		const left = () => budget - (now() - started);

		for (let attempt = 0; ; attempt++) {
			let response: Response;
			try {
				response = await (options.fetch ?? fetch)(url, {
					headers,
					signal: AbortSignal.timeout(Math.max(1, Math.min(init.timeoutMs ?? timeoutMs, left())))
				});
			} catch (error) {
				if (isTimeout(error)) throw new FtcApiError(504, path, 'FTC API timed out');
				const wait = backoff(attempt);
				if (attempt < retries && wait < left()) {
					await sleep(wait);
					continue;
				}
				throw new FtcApiError(502, path, 'FTC API is unreachable');
			}

			const lastModified = response.headers.get('last-modified');
			if (response.status === 304) {
				return { status: 'unchanged', lastModified: lastModified ?? init.ifModifiedSince ?? null };
			}
			if (response.ok) {
				try {
					return { status: 'ok', body: await response.json(), lastModified };
				} catch (error) {
					if (isTimeout(error)) throw new FtcApiError(504, path, 'FTC API timed out');
					throw new FtcApiError(502, path, 'FTC API sent a response that is not JSON');
				}
			}

			await response.body?.cancel();
			const retryable = response.status === 429 || response.status >= 500;
			if (retryable && attempt < retries) {
				const wait =
					response.status === 429
						? (parseRetryAfter(response.headers.get('retry-after')) ?? backoff(attempt))
						: backoff(attempt);
				if (wait <= maxRetryWaitMs && wait < left()) {
					await sleep(wait);
					continue;
				}
			}
			throw new FtcApiError(response.status, path, describeStatus(response.status));
		}
	}

	async function get<S extends z.ZodType>(
		path: string,
		schema: S,
		init: FtcRequestOptions = {}
	): Promise<FtcResponse<z.output<S>>> {
		const response = await request(path, init);
		if (response.status === 'unchanged') return response;
		const parsed = schema.safeParse(response.body);
		if (!parsed.success) {
			console.warn(
				`FTC API shape changed for ${path}: ${z.prettifyError(parsed.error).slice(0, 500)}`
			);
			throw new FtcApiError(502, path, 'FTC API sent data in an unexpected shape');
		}
		return { status: 'ok', body: parsed.data, lastModified: response.lastModified };
	}

	return { season, configured: authorization !== null, request, get, breaker };
}

export type FtcClient = ReturnType<typeof createFtcClient>;
