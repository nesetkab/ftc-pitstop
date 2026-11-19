import * as z from 'zod';
import { SEASON } from '#lib/game/biobuzz.ts';

export const FTC_API_ROOT = 'https://ftc-api.firstinspires.org/v2.0/';

export type FtcResponse<T> =
	| { status: 'ok'; body: T; lastModified: string | null }
	| { status: 'unchanged'; lastModified: string | null };

export interface FtcRequestOptions {
	ifModifiedSince?: string | null;
}

export interface FtcClientOptions {
	username?: string;
	apiKey?: string;
	season?: number;
	fetch?: typeof fetch;
	timeoutMs?: number;
	retries?: number;
	maxRetryWaitMs?: number;
	sleep?: (ms: number) => Promise<void>;
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
	const timeoutMs = options.timeoutMs ?? 15_000;
	const retries = options.retries ?? 2;
	const maxRetryWaitMs = options.maxRetryWaitMs ?? 10_000;
	const sleep = options.sleep ?? defaultSleep;
	const authorization =
		options.username && options.apiKey
			? `Basic ${btoa(`${options.username}:${options.apiKey}`)}`
			: null;

	async function request(path: string, init: FtcRequestOptions = {}): Promise<FtcResponse<unknown>> {
		if (!authorization) throw new FtcApiError(503, path, 'FTC API credentials are not configured');
		const headers: Record<string, string> = { authorization, accept: 'application/json' };
		if (init.ifModifiedSince) headers['if-modified-since'] = init.ifModifiedSince;
		const url = `${FTC_API_ROOT}${season}/${path}`;

		for (let attempt = 0; ; attempt++) {
			let response: Response;
			try {
				response = await (options.fetch ?? fetch)(url, {
					headers,
					signal: AbortSignal.timeout(timeoutMs)
				});
			} catch (error) {
				if (attempt < retries) {
					await sleep(backoff(attempt));
					continue;
				}
				throw isTimeout(error)
					? new FtcApiError(504, path, 'FTC API timed out')
					: new FtcApiError(502, path, 'FTC API is unreachable');
			}

			const lastModified = response.headers.get('last-modified');
			if (response.status === 304) {
				return { status: 'unchanged', lastModified: lastModified ?? init.ifModifiedSince ?? null };
			}
			if (response.ok) {
				try {
					return { status: 'ok', body: await response.json(), lastModified };
				} catch {
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
				if (wait <= maxRetryWaitMs) {
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
			console.warn(`FTC API shape changed for ${path}: ${z.prettifyError(parsed.error).slice(0, 500)}`);
			throw new FtcApiError(502, path, 'FTC API sent data in an unexpected shape');
		}
		return { status: 'ok', body: parsed.data, lastModified: response.lastModified };
	}

	return { season, configured: authorization !== null, request, get };
}

export type FtcClient = ReturnType<typeof createFtcClient>;
