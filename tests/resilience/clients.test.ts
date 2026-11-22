import { describe, expect, it, vi } from 'vitest';
import * as z from 'zod';
import { createBreaker } from '#lib/server/breaker.ts';
import { createFtcClient } from '#lib/server/ftc/client.ts';
import { createFtcScoutClient } from '#lib/server/ftcscout.ts';
import { createNexusClient } from '#lib/server/nexus.ts';

const timeout = () =>
	Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

function always(make: () => Response | Error) {
	return vi.fn<typeof fetch>(async () => {
		const next = make();
		if (next instanceof Error) throw next;
		return next;
	});
}

function hung(_input: RequestInfo | URL, init?: RequestInit) {
	return new Promise<Response>((_, reject) => {
		init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
	});
}

function ftcWith(fetcher: typeof fetch, clock = { now: 0 }) {
	return createFtcClient({
		username: 'tester',
		apiKey: 'not-a-real-key',
		fetch: fetcher,
		sleep: async () => {},
		now: () => clock.now
	});
}

describe('FTC API client under failure', () => {
	it('gives up on a hung request within its timeout and does not retry it', async () => {
		const fetcher = vi.fn(hung);
		const ftc = createFtcClient({
			username: 'tester',
			apiKey: 'not-a-real-key',
			fetch: fetcher,
			timeoutMs: 30
		});
		const started = performance.now();
		await expect(ftc.request('events')).rejects.toMatchObject({
			status: 504,
			message: 'FTC API timed out'
		});
		expect(performance.now() - started).toBeLessThan(1000);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('defaults to a timeout well under the page budget', async () => {
		const fetcher = always(() => Response.json({ events: [] }));
		await ftcWith(fetcher).request('events');
		const signal = fetcher.mock.calls[0][1]?.signal;
		expect(signal).toBeInstanceOf(AbortSignal);
		const ftc = createFtcClient({ username: 'a', apiKey: 'b', fetch: vi.fn(hung) });
		const started = performance.now();
		await expect(ftc.request('events')).rejects.toMatchObject({ status: 504 });
		expect(performance.now() - started).toBeLessThan(4500);
	}, 10_000);

	it.each([
		['a 500', () => new Response('oops', { status: 500 }), 500],
		['a 401', () => new Response('nope', { status: 401 }), 401],
		['garbage JSON', () => new Response('<html>down</html>', { status: 200 }), 502],
		['a timeout', () => timeout(), 504],
		['a dropped connection', () => new TypeError('fetch failed'), 502]
	])('stops calling after repeated %s and reports it paused', async (_, make, status) => {
		const fetcher = always(make);
		const ftc = ftcWith(fetcher);
		for (let i = 0; i < 5; i++) {
			await expect(ftc.request('rankings/USAZGIQ')).rejects.toMatchObject({ status });
		}
		const calls = fetcher.mock.calls.length;
		await expect(ftc.request('rankings/USAZGIQ')).rejects.toMatchObject({
			status: 503,
			message: 'FTC API is paused after errors'
		});
		expect(fetcher).toHaveBeenCalledTimes(calls);
		expect(ftc.breaker.isOpen()).toBe(true);
	});

	it('does not count missing events against the API', async () => {
		const fetcher = always(() => Response.json('Invalid Event Requested', { status: 404 }));
		const ftc = ftcWith(fetcher);
		for (let i = 0; i < 8; i++) await expect(ftc.request('rankings/NOPE')).rejects.toBeDefined();
		expect(fetcher).toHaveBeenCalledTimes(8);
		expect(ftc.breaker.isOpen()).toBe(false);
	});

	it('probes again after the cooldown and recovers', async () => {
		const clock = { now: 0 };
		let healthy = false;
		const fetcher = always(() =>
			healthy ? Response.json({ rankings: [] }) : new Response('oops', { status: 503 })
		);
		const ftc = ftcWith(fetcher, clock);
		for (let i = 0; i < 5; i++) await expect(ftc.request('rankings/X')).rejects.toBeDefined();
		await expect(ftc.request('rankings/X')).rejects.toMatchObject({ status: 503 });
		healthy = true;
		clock.now += 10_000;
		await expect(ftc.request('rankings/X')).resolves.toMatchObject({ status: 'ok' });
		await expect(ftc.request('rankings/X')).resolves.toMatchObject({ status: 'ok' });
	});

	it('keeps retries inside the request budget', async () => {
		const clock = { now: 0 };
		const fetcher = always(() => new Response('busy', { status: 502 }));
		const sleep = vi.fn(async (ms: number) => {
			clock.now += ms;
		});
		const ftc = createFtcClient({
			username: 'a',
			apiKey: 'b',
			fetch: fetcher,
			sleep,
			now: () => clock.now,
			budgetMs: 1000,
			retries: 5
		});
		await expect(ftc.request('events')).rejects.toMatchObject({ status: 502 });
		expect(clock.now).toBeLessThan(1000);
		expect(fetcher.mock.calls.length).toBeLessThan(4);
	});
});

describe('FTCScout client under failure', () => {
	const schema = z.object({ ok: z.boolean() });

	it('pauses every query once the host keeps failing', async () => {
		const fetcher = always(() => new Response('down', { status: 502 }));
		const scout = createFtcScoutClient({ fetch: fetcher, sleep: async () => {} });
		for (let i = 0; i < 5; i++) {
			await expect(scout.query(`Q${i}`, `query Q${i} { ok }`, {}, schema)).rejects.toBeDefined();
		}
		const calls = fetcher.mock.calls.length;
		await expect(scout.query('Fresh', 'query Fresh { ok }', {}, schema)).rejects.toMatchObject({
			status: 503,
			message: 'FTCScout is paused after errors'
		});
		expect(fetcher).toHaveBeenCalledTimes(calls);
	});

	it('does not blame the host for a query it rejects', async () => {
		const fetcher = always(() => Response.json({ errors: [{ message: 'bad field' }] }));
		const scout = createFtcScoutClient({ fetch: fetcher, sleep: async () => {} });
		for (let i = 0; i < 6; i++) {
			await expect(scout.query(`Q${i}`, `query Q${i} { nope }`, {}, schema)).rejects.toMatchObject({
				status: 502
			});
		}
		expect(scout.breaker.isOpen()).toBe(false);
	});

	it('times out a hung request quickly', async () => {
		const scout = createFtcScoutClient({ fetch: vi.fn(hung), timeoutMs: 30 });
		await expect(scout.query('Q', 'query Q { ok }', {}, schema)).rejects.toMatchObject({
			status: 504
		});
	});
});

describe('Nexus client under failure', () => {
	it('times out a hung request and names it', async () => {
		const nexus = createNexusClient({ apiKey: 'key', fetch: vi.fn(hung), timeoutMs: 30 });
		await expect(nexus.eventStatus('USAZGIQ')).rejects.toMatchObject({
			status: 504,
			message: 'Nexus timed out'
		});
	});

	it('reports garbage instead of crashing', async () => {
		const nexus = createNexusClient({
			apiKey: 'key',
			fetch: always(() => new Response('<html>', { status: 200 }))
		});
		await expect(nexus.eventStatus('USAZGIQ')).rejects.toMatchObject({ status: 502 });
	});

	it('stops calling Nexus after repeated failures', async () => {
		const fetcher = always(() => new TypeError('fetch failed'));
		const nexus = createNexusClient({
			apiKey: 'key',
			fetch: fetcher,
			breaker: createBreaker({ threshold: 3 })
		});
		for (let i = 0; i < 3; i++) await expect(nexus.eventStatus('X')).rejects.toBeDefined();
		await expect(nexus.eventStatus('X')).rejects.toMatchObject({
			message: 'Nexus is paused after errors'
		});
		expect(fetcher).toHaveBeenCalledTimes(3);
	});
});
