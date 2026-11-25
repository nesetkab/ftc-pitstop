import { beforeEach, describe, expect, it, vi } from 'vitest';
import { followedBundle, match, ranking } from '#lib/components/team/fixtures.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { DataError } from '#lib/server/errors.ts';
import { GET } from './+server.ts';

const event = vi.hoisted(() => ({ loadEventBundle: vi.fn() }));

vi.mock('#lib/server/event.ts', () => event);

function call(code: string) {
	return GET({ params: { code } } as never) as Promise<Response>;
}

beforeEach(() => {
	event.loadEventBundle.mockReset();
});

describe('followed teams live endpoint', () => {
	it('sends only rank and match status for each team with the event cache', async () => {
		event.loadEventBundle.mockResolvedValue({
			...followedBundle(
				[match(26, [26670, 1], [2, 3], '2026-11-14T20:58:00Z', false)],
				[ranking(7, 26670, 3, 0)]
			),
			teams: [{ number: 26670, name: 'SCA Iron Eagles' }],
			awards: [],
			alliances: [],
			cacheControl: CACHE_CONTROL.live
		});
		const response = await call('USAZGIQ');
		expect(event.loadEventBundle).toHaveBeenCalledWith('USAZGIQ');
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.live);
		const body = await response.json();
		expect(Object.keys(body).sort()).toEqual(['scheduled', 'status', 'teams']);
		expect(body.teams).toBe(1);
		expect(body.status['26670']).toMatchObject({
			rank: 7,
			record: '3-0-0',
			next: { key: 'q26', side: 'red' }
		});
		expect(Object.keys(body.status)).toEqual(['1', '2', '3', '26670']);
	});

	it('passes on a missing event and does not cache a failure', async () => {
		event.loadEventBundle.mockRejectedValueOnce(new DataError(404, 'Event not found'));
		expect((await call('NOPE')).status).toBe(404);
		event.loadEventBundle.mockRejectedValueOnce(new Error('down'));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const response = await call('USAZGIQ');
		expect(response.status).toBe(503);
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.none);
	});
});
