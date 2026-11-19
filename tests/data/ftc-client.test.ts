import { describe, expect, it, vi } from 'vitest';
import * as z from 'zod';
import { createFtcClient, FtcApiError, parseRetryAfter } from '#lib/server/ftc/client.ts';

function responses(...items: (Response | Error)[]) {
	const queue = [...items];
	return vi.fn<typeof fetch>(async () => {
		const next = queue.shift();
		if (!next) throw new Error('no more responses');
		if (next instanceof Error) throw next;
		return next;
	});
}

const ok = (body: unknown, headers: Record<string, string> = {}) =>
	Response.json(body, { headers });

function client(fetcher: typeof fetch, sleep = vi.fn(async () => {})) {
	return {
		sleep,
		ftc: createFtcClient({ username: 'tester', apiKey: 'not-a-real-key', fetch: fetcher, sleep })
	};
}

describe('FTC API client', () => {
	it('sends basic auth and returns the body with Last-Modified', async () => {
		const fetcher = responses(
			ok({ rankings: [] }, { 'last-modified': 'Sun, 15 Nov 2026 00:17:42 GMT' })
		);
		const { ftc } = client(fetcher);
		const result = await ftc.request('rankings/USAZGIQ');
		expect(result).toEqual({
			status: 'ok',
			body: { rankings: [] },
			lastModified: 'Sun, 15 Nov 2026 00:17:42 GMT'
		});
		const [url, init] = fetcher.mock.calls[0];
		expect(String(url)).toBe('https://ftc-api.firstinspires.org/v2.0/2026/rankings/USAZGIQ');
		const headers = new Headers(init?.headers);
		expect(headers.get('authorization')).toBe(`Basic ${btoa('tester:not-a-real-key')}`);
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it('sends If-Modified-Since and reports 304 as unchanged', async () => {
		const fetcher = responses(new Response(null, { status: 304 }));
		const { ftc } = client(fetcher);
		const result = await ftc.request('scores/USAZGIQ/qual', {
			ifModifiedSince: 'Sun, 15 Nov 2026 00:17:42 GMT'
		});
		expect(result).toEqual({ status: 'unchanged', lastModified: 'Sun, 15 Nov 2026 00:17:42 GMT' });
		expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('if-modified-since')).toBe(
			'Sun, 15 Nov 2026 00:17:42 GMT'
		);
	});

	it('retries server errors and network failures with backoff', async () => {
		const fetcher = responses(
			new Response('oops', { status: 502 }),
			new TypeError('fetch failed'),
			ok({ awards: [] })
		);
		const { ftc, sleep } = client(fetcher);
		expect((await ftc.request('awards/USAZGIQ')).status).toBe('ok');
		expect(fetcher).toHaveBeenCalledTimes(3);
		expect(sleep).toHaveBeenCalledTimes(2);
		const [first, second] = sleep.mock.calls.map((call: unknown[]) => call[0] as number);
		expect(first).toBeGreaterThanOrEqual(400);
		expect(second).toBeGreaterThanOrEqual(800);
	});

	it('waits for Retry-After on 429', async () => {
		const fetcher = responses(
			new Response('slow down', { status: 429, headers: { 'retry-after': '3' } }),
			ok({})
		);
		const { ftc, sleep } = client(fetcher);
		await ftc.request('events?eventCode=USAZGIQ');
		expect(sleep).toHaveBeenCalledWith(3000);
	});

	it('gives up when Retry-After is too long', async () => {
		const fetcher = responses(
			new Response('later', { status: 429, headers: { 'retry-after': '120' } })
		);
		const { ftc, sleep } = client(fetcher);
		await expect(ftc.request('events')).rejects.toMatchObject({
			status: 429,
			message: 'FTC API rate limit reached'
		});
		expect(sleep).not.toHaveBeenCalled();
	});

	it('does not retry 404s and names timeouts', async () => {
		const missing = responses(Response.json('Invalid Event Requested', { status: 404 }));
		await expect(client(missing).ftc.request('rankings/NOPE')).rejects.toMatchObject({
			status: 404
		});
		expect(missing).toHaveBeenCalledTimes(1);
		const timeout = Object.assign(new Error('The operation was aborted due to timeout'), {
			name: 'TimeoutError'
		});
		const slow = responses(timeout, timeout, timeout);
		await expect(client(slow).ftc.request('rankings/USAZGIQ')).rejects.toMatchObject({
			status: 504,
			message: 'FTC API timed out'
		});
	});

	it('times out a hung request after the configured time', async () => {
		const hung = vi.fn(
			(_input: RequestInfo | URL, init?: RequestInit) =>
				new Promise<Response>((_, reject) => {
					init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
				})
		);
		const ftc = createFtcClient({
			username: 'a',
			apiKey: 'b',
			fetch: hung,
			timeoutMs: 20,
			retries: 0
		});
		await expect(ftc.request('events')).rejects.toMatchObject({ status: 504 });
	});

	it('fails clearly without credentials', async () => {
		const fetcher = vi.fn();
		const ftc = createFtcClient({ fetch: fetcher as unknown as typeof fetch });
		expect(ftc.configured).toBe(false);
		await expect(ftc.request('events')).rejects.toMatchObject({
			status: 503,
			message: 'FTC API credentials are not configured'
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('validates bodies with zod', async () => {
		const schema = z.object({ rankings: z.array(z.object({ rank: z.number() })) });
		const good = await client(responses(ok({ rankings: [{ rank: 1, extra: true }] }))).ftc.get(
			'rankings/X',
			schema
		);
		expect(good).toMatchObject({ status: 'ok', body: { rankings: [{ rank: 1 }] } });
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const bad = client(responses(ok({ rankings: 'nope' }))).ftc.get('rankings/X', schema);
		await expect(bad).rejects.toBeInstanceOf(FtcApiError);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('parses Retry-After seconds and dates', () => {
		expect(parseRetryAfter('5')).toBe(5000);
		expect(
			parseRetryAfter('Thu, 19 Nov 2026 07:00:10 GMT', Date.parse('Thu, 19 Nov 2026 07:00:00 GMT'))
		).toBe(10_000);
		expect(parseRetryAfter(null)).toBeNull();
		expect(parseRetryAfter('soon')).toBeNull();
	});
});
