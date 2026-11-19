import { describe, expect, it } from 'vitest';
import { createCache } from '#lib/server/cache.ts';
import { createFtcScoutClient } from '#lib/server/ftcscout.ts';
import { createScoutLeaderboard } from './scout.server.ts';

interface Entry {
	team: number;
	event: string;
	opr: number;
	stats?: boolean;
	region?: string | null;
	city?: string | null;
}

function record(entry: Entry) {
	return {
		data: {
			teamNumber: entry.team,
			team: {
				name: `Team ${entry.team}`,
				location: { city: entry.city ?? 'Phoenix', state: 'AZ', country: 'USA' }
			},
			event: { regionCode: entry.region === undefined ? 'USAZ' : entry.region },
			stats:
				entry.stats === false
					? null
					: {
							qualMatchesPlayed: 6,
							opr: {
								totalPointsNp: entry.opr,
								autoPoints: entry.opr / 4,
								dcPoints: (entry.opr * 3) / 4,
								tips: 2.5
							}
						}
		}
	};
}

function server(entries: Entry[]) {
	const skips: number[] = [];
	const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body));
		const { skip, take } = body.variables as { skip: number; take: number };
		skips.push(skip);
		return Response.json({
			data: {
				tepRecords: { count: entries.length, data: entries.slice(skip, skip + take).map(record) }
			}
		});
	};
	return { fetch: fetcher as typeof fetch, skips };
}

function build(entries: Entry[], limit = 100) {
	let time = 1_000_000;
	const remote = server(entries);
	const leaderboard = createScoutLeaderboard({
		scout: createFtcScoutClient({ fetch: remote.fetch, sleep: async () => {} }),
		cache: createCache({ onError: () => {}, now: () => time }),
		limit
	});
	return { leaderboard, remote, advance: (ms: number) => (time += ms) };
}

describe('createScoutLeaderboard', () => {
	it('keeps each team once, at its best event', async () => {
		const { leaderboard } = build([
			{ team: 10, event: 'A', opr: 120 },
			{ team: 20, event: 'B', opr: 110 },
			{ team: 10, event: 'C', opr: 90 },
			{ team: 30, event: 'D', opr: 40 }
		]);
		const { rows } = await leaderboard.load();
		expect(rows.map((row) => [row.team, row.opr])).toEqual([
			[10, 120],
			[20, 110],
			[30, 40]
		]);
	});

	it('maps names, places, parts and the best event matches', async () => {
		const { leaderboard } = build([{ team: 10, event: 'A', opr: 100, city: 'Gilbert' }]);
		const { rows } = await leaderboard.load();
		expect(rows[0]).toEqual({
			team: 10,
			name: 'Team 10',
			city: 'Gilbert',
			state: 'AZ',
			country: 'USA',
			region: 'USAZ',
			opr: 100,
			auto: 25,
			teleop: 75,
			tips: 2.5,
			matches: 6,
			events: null
		});
	});

	it('skips entries without stats and copes with a missing region', async () => {
		const { leaderboard } = build([
			{ team: 10, event: 'A', opr: 100, stats: false },
			{ team: 20, event: 'B', opr: 80, region: null }
		]);
		const { rows } = await leaderboard.load();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ team: 20, region: null });
	});

	it('reads the list in pages of 50 up to the limit', async () => {
		const entries = Array.from({ length: 130 }, (_, index) => ({
			team: index + 1,
			event: 'E',
			opr: 200 - index
		}));
		const { leaderboard, remote } = build(entries, 100);
		const { rows } = await leaderboard.load();
		expect(remote.skips.sort((a, b) => a - b)).toEqual([0, 50]);
		expect(rows).toHaveLength(100);
	});

	it('serves repeat loads from the cache until it expires', async () => {
		const { leaderboard, remote, advance } = build([{ team: 10, event: 'A', opr: 100 }], 50);
		await leaderboard.load();
		await leaderboard.load();
		expect(remote.skips).toHaveLength(1);
		advance(3_700_000);
		await leaderboard.load();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(remote.skips.length).toBeGreaterThan(1);
	});
});
