import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AllianceSelection, Team } from '#lib/types.ts';
import { fetchTeamName, SelectionFeed } from '#lib/workspace/feed.svelte.ts';

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
	function start(event: () => string | null, fetcher: typeof fetch) {
		let feed!: SelectionFeed;
		const stop = $effect.root(() => {
			feed = new SelectionFeed(event, 15_000, fetcher);
		});
		flushSync();
		return { feed, stop };
	}

	it('labels teams the alliances have taken', async () => {
		const fetcher = vi.fn(async () => respond({ alliances, teams }));
		const { feed, stop } = start(() => 'USAZGIQ', fetcher as unknown as typeof fetch);
		await vi.advanceTimersByTimeAsync(0);
		expect(fetcher).toHaveBeenCalledWith('/api/events/USAZGIQ');
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
});
