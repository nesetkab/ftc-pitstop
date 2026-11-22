import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataError } from '#lib/server/errors.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { load } from './+layout.server.ts';

const server = vi.hoisted(() => ({
	loadEventBundle: vi.fn(),
	loadEventAnalysisEntry: vi.fn()
}));

vi.mock('#lib/server/event.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/server/event.ts')>()),
	loadEventBundle: server.loadEventBundle
}));

vi.mock('#lib/server/analysis.ts', () => ({
	loadEventAnalysisEntry: server.loadEventAnalysisEntry
}));

const setHeaders = vi.fn();

function run(code: string, path = `/events/${code}`, search = '', route = '/(app)/events/[code]') {
	const url = new URL(`http://localhost${path}${search}`);
	return load({
		params: { code },
		url,
		route: { id: route },
		setHeaders,
		depends: vi.fn(),
		untrack: <T>(fn: () => T) => fn()
	} as never) as Promise<{ bundle: unknown; analysis: unknown }>;
}

beforeEach(() => {
	setHeaders.mockReset();
	server.loadEventBundle.mockReset().mockResolvedValue(bundleWith(CACHE_CONTROL.finished));
	server.loadEventAnalysisEntry.mockReset().mockImplementation(async () => ({
		analysis: { code: 'USAZGIQ' },
		cacheControl: (await server.loadEventBundle()).cacheControl
	}));
});

function bundleWith(cacheControl: string) {
	return { event: { code: 'USAZGIQ' }, cacheControl };
}

describe('event layout', () => {
	it.each([CACHE_CONTROL.live, CACHE_CONTROL.short, CACHE_CONTROL.finished])(
		'lets the CDN keep the page as long as the event data allows (%s)',
		async (cacheControl) => {
			server.loadEventBundle.mockResolvedValue(bundleWith(cacheControl));
			await run('USAZGIQ');
			expect(setHeaders).toHaveBeenLastCalledWith({ 'cache-control': cacheControl });
		}
	);

	it('keeps a finished event page only briefly when the analysis is missing or cold', async () => {
		server.loadEventAnalysisEntry.mockRejectedValue(new Error('boom'));
		const data = await run('USAZGIQ');
		expect(data.analysis).toBeNull();
		expect(setHeaders).toHaveBeenLastCalledWith({ 'cache-control': CACHE_CONTROL.live });
		server.loadEventAnalysisEntry.mockResolvedValue({
			analysis: {},
			cacheControl: CACHE_CONTROL.live
		});
		await run('USAZGIQ');
		expect(setHeaders).toHaveBeenLastCalledWith({ 'cache-control': CACHE_CONTROL.live });
	});

	it('leaves the header to pages that pick their own', async () => {
		const data = await run('USAZGIQ', '/events/USAZGIQ/teams', '', '/(app)/events/[code]/teams');
		expect(setHeaders).not.toHaveBeenCalled();
		expect(data).toMatchObject({ cacheControl: CACHE_CONTROL.finished });
	});

	it('loads the event for a clean code', async () => {
		const data = await run('USAZGIQ');
		expect(data.bundle).toEqual({ event: { code: 'USAZGIQ' } });
		expect(server.loadEventBundle).toHaveBeenCalledWith('USAZGIQ');
	});

	it('redirects a lowercase code to the uppercase page and keeps the rest of the address', async () => {
		await expect(run('usazgiq', '/events/usazgiq/matches/q1', '?team=2844')).rejects.toMatchObject({
			status: 308,
			location: '/events/USAZGIQ/matches/q1?team=2844'
		});
		expect(server.loadEventBundle).not.toHaveBeenCalled();
	});

	it('only rewrites the code segment of the path', async () => {
		await expect(run('ev', '/events/ev/schedule')).rejects.toMatchObject({
			status: 308,
			location: '/events/EV/schedule'
		});
		await expect(run('ents', '/events/ents/matches/q1')).rejects.toMatchObject({
			location: '/events/ENTS/matches/q1'
		});
	});

	it.each([
		'..',
		'//evil.example',
		'a b',
		' usazgiq',
		'USAZGIQ\n',
		'x'.repeat(25),
		'%2F%2Fevil',
		'',
		'é1'
	])('answers 404 for the code %j without loading anything', async (code) => {
		await expect(run(code, `/events/${encodeURIComponent(code)}`)).rejects.toMatchObject({
			status: 404
		});
		expect(server.loadEventBundle).not.toHaveBeenCalled();
		expect(server.loadEventAnalysisEntry).not.toHaveBeenCalled();
	});

	it('maps missing events to 404 and other trouble to 503', async () => {
		server.loadEventBundle.mockRejectedValue(new DataError(404, 'Event not found'));
		await expect(run('USAZGIQ')).rejects.toMatchObject({ status: 404 });
		server.loadEventBundle.mockRejectedValue(new Error('boom'));
		await expect(run('USAZGIQ')).rejects.toMatchObject({ status: 503 });
	});
});
