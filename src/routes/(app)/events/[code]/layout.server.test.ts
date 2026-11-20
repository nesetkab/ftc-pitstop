import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataError } from '#lib/server/errors.ts';
import { load } from './+layout.server.ts';

const server = vi.hoisted(() => ({
	loadEventBundle: vi.fn(),
	loadEventAnalysis: vi.fn()
}));

vi.mock('#lib/server/event.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/server/event.ts')>()),
	loadEventBundle: server.loadEventBundle
}));

vi.mock('#lib/server/analysis.ts', () => ({ loadEventAnalysis: server.loadEventAnalysis }));

const setHeaders = vi.fn();

function run(code: string, path = `/events/${code}`, search = '') {
	const url = new URL(`http://localhost${path}${search}`);
	return load({
		params: { code },
		url,
		setHeaders,
		depends: vi.fn(),
		untrack: <T>(fn: () => T) => fn()
	} as never) as Promise<{ bundle: unknown; analysis: unknown }>;
}

beforeEach(() => {
	setHeaders.mockReset();
	server.loadEventBundle.mockReset().mockResolvedValue({ event: { code: 'USAZGIQ' } });
	server.loadEventAnalysis.mockReset().mockResolvedValue(null);
});

describe('event layout', () => {
	it('lets the CDN cache live events briefly and quiet ones longer', async () => {
		server.loadEventBundle.mockResolvedValue({ event: { code: 'USAZGIQ' }, phase: 'quals' });
		await run('USAZGIQ');
		expect(setHeaders).toHaveBeenLastCalledWith({
			'cache-control': 'public, s-maxage=30, stale-while-revalidate=300'
		});
		server.loadEventBundle.mockResolvedValue({ event: { code: 'USAZGIQ' }, phase: 'done' });
		await run('USAZGIQ');
		expect(setHeaders).toHaveBeenLastCalledWith({
			'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600'
		});
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
		expect(server.loadEventAnalysis).not.toHaveBeenCalled();
	});

	it('maps missing events to 404 and other trouble to 503', async () => {
		server.loadEventBundle.mockRejectedValue(new DataError(404, 'Event not found'));
		await expect(run('USAZGIQ')).rejects.toMatchObject({ status: 404 });
		server.loadEventBundle.mockRejectedValue(new Error('boom'));
		await expect(run('USAZGIQ')).rejects.toMatchObject({ status: 503 });
	});
});
