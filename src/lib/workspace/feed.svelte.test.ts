import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AllianceSelection, Team } from '#lib/types.ts';
import { fetchTeamName, SelectionFeed, SETTLED_INTERVAL } from '#lib/workspace/feed.svelte.ts';

const alliances: AllianceSelection[] = [
	{ seed: 1, name: 'Alliance 1', captain: 100, picks: [101], backup: null, backupReplaced: null },
	{ seed: 2, name: 'Alliance 2', captain: 200, picks: [], backup: null, backupReplaced: null }
];

const teams = [
	{ number: 100, name: 'Iron Eagles' },
	{ number: 2844, name: 'Valley X Robotics' }
] as Team[];

function respond(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('team names', () => {
	it('reads the short name from the team api', async () => {
		const fetcher = vi.fn(async () => respond({ team: { name: ' Valley X Robotics ' } }));
		expect(await fetchTeamName(2844, fetcher as unknown as typeof fetch)).toBe('Valley X Robotics');
		expect(fetcher).toHaveBeenCalledWith('/api/teams/2844');
	});

	it('gives up quietly when the team is unknown or the api is down', async () => {
		const missing = async () => respond({ error: 'Team not found' }, 404);
		const odd = async () => respond({ team: {} });
		const down = async () => {
			throw new TypeError('offline');
		};
		expect(await fetchTeamName(1, missing as unknown as typeof fetch)).toBeNull();
		expect(await fetchTeamName(1, odd as unknown as typeof fetch)).toBeNull();
		expect(await fetchTeamName(1, down as unknown as typeof fetch)).toBeNull();
	});
});

describe('selection feed', () => {
	function start(event: () => string | null, fetcher: typeof fetch, picks: number[] = []) {
		let feed!: SelectionFeed;
		const stop = $effect.root(() => {
			feed = new SelectionFeed(event, { fetcher, teams: () => picks });
		});
		flushSync();
		return { feed, stop };
	}

	it('labels teams the alliances have taken', async () => {
		const fetcher = vi.fn(async () => respond({ alliances, teams }));
		const { feed, stop } = start(() => 'USAZGIQ', fetcher as unknown as typeof fetch);
		await vi.advanceTimersByTimeAsync(0);
		expect(fetcher).toHaveBeenCalledWith('/api/events/USAZGIQ/lite');
		expect(feed.labels.get(101)).toBe('Picked by alliance 1');
		expect(feed.labels.get(100)).toBe('Captain of alliance 1');
		expect(feed.labels.has(2844)).toBe(false);
		expect(await feed.name(2844)).toBe('Valley X Robotics');
		stop();
	});

	it('asks again after the interval and stops when torn down', async () => {
		const fetcher = vi.fn(async () => respond({ alliances, teams }));
		const { stop } = start(() => 'USAZGIQ', fetcher as unknown as typeof fetch);
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(15_000);
		expect(fetcher).toHaveBeenCalledTimes(2);
		stop();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('does nothing without an event code', async () => {
		const fetcher = vi.fn();
		const { feed, stop } = start(() => null, fetcher as unknown as typeof fetch);
		await vi.advanceTimersByTimeAsync(30_000);
		expect(fetcher).not.toHaveBeenCalled();
		expect(feed.labels.size).toBe(0);
		stop();
	});

	it('keeps the last labels when a refresh fails', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(respond({ alliances, teams }))
			.mockRejectedValue(new TypeError('offline'));
		const { feed, stop } = start(() => 'USAZGIQ', fetcher as unknown as typeof fetch);
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(15_000);
		expect(feed.labels.get(101)).toBe('Picked by alliance 1');
		stop();
	});

	it('stops asking once the event is done and slows down during playoffs', async () => {
		const done = vi.fn(async () => respond({ alliances, teams, phase: 'done' }));
		const first = start(() => 'USAZGIQ', done as unknown as typeof fetch);
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(done).toHaveBeenCalledTimes(1);
		first.stop();

		const playoffs = vi.fn(async () => respond({ alliances, teams, phase: 'playoffs' }));
		const second = start(() => 'USAZGIQ', playoffs as unknown as typeof fetch);
		await vi.advanceTimersByTimeAsync(SETTLED_INTERVAL - 1);
		expect(playoffs).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(playoffs).toHaveBeenCalledTimes(2);
		second.stop();
	});

	it('shows each team its rank and aOPR, asking for ratings only after new results', async () => {
		const rankings = [{ team: 100, rank: 2 }];
		const lite = (played: number) =>
			respond({
				alliances,
				teams,
				rankings,
				matches: Array.from({ length: played }, () => ({ result: {} }))
			});
		const fetcher = vi.fn(async (url: string) =>
			url.endsWith('/analysis')
				? respond({ ratings: [{ team: 100, opr: 41.5 }] })
				: lite(fetcher.mock.calls.length > 3 ? 4 : 3)
		);
		const { feed, stop } = start(() => 'USAZGIQ', fetcher as unknown as typeof fetch);
		await vi.advanceTimersByTimeAsync(0);
		expect(feed.stats.get(100)).toEqual({ opr: 41.5, rank: 2 });
		await vi.advanceTimersByTimeAsync(15_000);
		const analysis = () =>
			fetcher.mock.calls.filter(([url]) => String(url).endsWith('/analysis')).length;
		expect(analysis()).toBe(1);
		await vi.advanceTimersByTimeAsync(15_000);
		expect(analysis()).toBe(2);
		stop();
	});

	it('falls back to season aOPR for picks that are not at the event', async () => {
		const fetcher = vi.fn(async (url: string) =>
			url.startsWith('/api/following')
				? respond({
						teams: [
							{ number: 5, opr: 33.25 },
							{ number: 6, opr: null }
						]
					})
				: respond({ alliances, teams })
		);
		const { feed, stop } = start(() => 'USAZGIQ', fetcher as unknown as typeof fetch, [100, 5, 6]);
		await vi.advanceTimersByTimeAsync(0);
		flushSync();
		await vi.advanceTimersByTimeAsync(0);
		expect(fetcher).toHaveBeenCalledWith('/api/following?teams=5,6');
		expect(feed.stats.get(5)).toEqual({ opr: 33.25, rank: null, season: true });
		expect(feed.stats.get(6)).toEqual({ opr: null, rank: null, season: true });
		expect(feed.stats.has(100)).toBe(false);
		await vi.advanceTimersByTimeAsync(15_000);
		flushSync();
		const asked = fetcher.mock.calls.filter(([url]) => String(url).startsWith('/api/following'));
		expect(asked).toHaveLength(1);
		stop();
	});
});
