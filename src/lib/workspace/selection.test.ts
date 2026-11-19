import { beforeAll, describe, expect, it } from 'vitest';
import type { AllianceOdds, EventAnalysis, PickOption } from '#lib/analysis/types.ts';
import { createCache } from '#lib/server/cache.ts';
import { createLoaders, type LoadedBundle } from '#lib/server/event.ts';
import { createFtcClient } from '#lib/server/ftc/client.ts';
import { mapAlliances } from '#lib/server/ftc/mappers.ts';
import type { FtcAlliancesResponse } from '#lib/server/ftc/schemas.ts';
import { createFtcScoutClient } from '#lib/server/ftcscout.ts';
import { createNexusClient } from '#lib/server/nexus.ts';
import type { AllianceSelection } from '#lib/types.ts';
import {
	bundleSignature,
	deriveSelection,
	formatSeeds,
	isTaken,
	oddsRows,
	parkAverages,
	refreshInterval,
	selectionTable,
	takenLabel
} from '#lib/workspace/selection.ts';
import { fixture, fixtureFetch, scoutFetch } from '../../../tests/data/helpers.ts';

const finished = mapAlliances(fixture<FtcAlliancesResponse>('USAZGIQ', 'alliances'));

function afterRound(...complete: number[]): AllianceSelection[] {
	return finished.map((alliance) =>
		complete.includes(alliance.seed) ? alliance : { ...alliance, picks: [] }
	);
}

const NOW = Date.parse('2026-11-19T12:00:00Z');

let bundle: LoadedBundle;

beforeAll(async () => {
	const loaders = createLoaders({
		ftc: createFtcClient({
			username: 'tester',
			apiKey: 'not-a-real-key',
			fetch: fixtureFetch().fetch,
			sleep: async () => {}
		}),
		scout: createFtcScoutClient({ fetch: scoutFetch({}).fetch, sleep: async () => {} }),
		nexus: createNexusClient({}),
		cache: createCache({ onError: () => {}, now: () => NOW }),
		now: () => NOW
	});
	bundle = await loaders.loadEventBundle('USAZGIQ');
});

describe('who is picking', () => {
	it('knows the selection is complete when every alliance has its pick', () => {
		const state = deriveSelection(finished);
		expect(state.started).toBe(true);
		expect(state.complete).toBe(true);
		expect(state.picking).toBeNull();
		expect(state.completed).toBe(6);
		expect(state.alliances.map((alliance) => alliance.progress)).toEqual(Array(6).fill('complete'));
	});

	it('finds the alliance on the clock', () => {
		const state = deriveSelection(afterRound(1, 2, 3, 4));
		expect(state.picking).toMatchObject({ seed: 5, captain: 14624, progress: 'picking' });
		expect(state.round).toBe(1);
		expect(state.completed).toBe(4);
		expect(state.complete).toBe(false);
		expect(state.alliances[5].progress).toBe('waiting');
	});

	it('moves to the next alliance after a pick', () => {
		const state = deriveSelection(afterRound(1, 2, 3, 4, 5));
		expect(state.picking).toMatchObject({ seed: 6, captain: 37557 });
		expect(state.completed).toBe(5);
	});

	it('starts with alliance 1', () => {
		const state = deriveSelection(afterRound());
		expect(state.picking?.seed).toBe(1);
		expect(state.completed).toBe(0);
	});

	it('does not guess when no alliances exist yet', () => {
		const state = deriveSelection([]);
		expect(state).toMatchObject({ started: false, complete: false, picking: null, completed: 0 });
		expect(state.status(14624)).toEqual({ kind: 'available', captainOf: null });
	});

	it('does not depend on the order alliances arrive in', () => {
		const state = deriveSelection([...afterRound(1, 2, 3, 4)].reverse());
		expect(state.picking?.seed).toBe(5);
		expect(state.alliances.map((alliance) => alliance.seed)).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it('goes back down the order in a second round', () => {
		const three: AllianceSelection[] = finished.slice(0, 4).map((alliance, index) => ({
			...alliance,
			picks: index === 3 ? [...alliance.picks, 90003] : alliance.picks
		}));
		const state = deriveSelection(three);
		expect(state.round).toBe(2);
		expect(state.picking?.seed).toBe(3);
		expect(state.alliances.map((alliance) => alliance.progress)).toEqual([
			'waiting',
			'waiting',
			'picking',
			'complete'
		]);
	});

	it('starts the second round from the last alliance', () => {
		const three = finished.slice(0, 4).map((alliance, index) => ({
			...alliance,
			picks: index === 0 ? [...alliance.picks, 90000] : alliance.picks
		}));
		expect(deriveSelection(three).picking?.seed).toBe(4);
	});

	it('uses the number of picks per alliance it is told about', () => {
		const state = deriveSelection(finished, { picksPerAlliance: 2 });
		expect(state.complete).toBe(false);
		expect(state.round).toBe(2);
		expect(state.picking?.seed).toBe(6);
	});
});

describe('taken teams', () => {
	const state = deriveSelection(afterRound(1, 2, 3, 4));

	it('marks picks and captains of finished alliances as taken', () => {
		expect(state.status(18421)).toEqual({ kind: 'pick', alliance: 1 });
		expect(state.status(26128)).toEqual({ kind: 'pick', alliance: 3 });
		expect(state.status(26670)).toEqual({ kind: 'captain', alliance: 1 });
		expect(isTaken(state.status(15135))).toBe(true);
	});

	it('treats the captain on the clock as taken', () => {
		expect(state.status(14624)).toEqual({ kind: 'captain', alliance: 5 });
	});

	it('leaves captains who have not picked yet available to higher seeds', () => {
		expect(state.status(37557)).toEqual({ kind: 'available', captainOf: 6 });
		expect(isTaken(state.status(37557))).toBe(false);
	});

	it('leaves everyone else available', () => {
		expect(state.status(2844)).toEqual({ kind: 'available', captainOf: null });
		expect(state.status(36980)).toEqual({ kind: 'available', captainOf: null });
	});

	it('writes the label shown next to a taken team', () => {
		expect(takenLabel(state.status(18421))).toBe('Picked by alliance 1');
		expect(takenLabel(state.status(26670))).toBe('Captain of alliance 1');
		expect(takenLabel(state.status(2844))).toBeNull();
	});

	it('marks backups', () => {
		const withBackup = finished.map((alliance) =>
			alliance.seed === 2 ? { ...alliance, backup: 36980 } : alliance
		);
		const next = deriveSelection(withBackup);
		expect(next.status(36980)).toEqual({ kind: 'backup', alliance: 2 });
		expect(takenLabel(next.status(36980))).toBe('Backup for alliance 2');
	});

	it('follows a captain who was picked and replaced', () => {
		const promoted = afterRound(1, 2, 3, 4).map((alliance) => {
			if (alliance.seed === 5) return { ...alliance, picks: [37557] };
			if (alliance.seed === 6) return { ...alliance, captain: 36980 };
			return alliance;
		});
		const next = deriveSelection(promoted);
		expect(next.status(37557)).toEqual({ kind: 'pick', alliance: 5 });
		expect(next.status(36980)).toEqual({ kind: 'captain', alliance: 6 });
		expect(next.picking?.seed).toBe(6);
	});
});

describe('refreshing', () => {
	it('polls fastest during selection', () => {
		expect(refreshInterval('selection')).toBe(10_000);
		expect(refreshInterval('quals')).toBe(30_000);
		expect(refreshInterval('playoffs')).toBe(60_000);
		expect(refreshInterval('done')).toBeNull();
		expect(refreshInterval('upcoming')).toBeNull();
	});

	it('notices when a pick or a result changes', () => {
		const before = bundleSignature({ ...bundle, alliances: afterRound(1, 2, 3, 4) });
		expect(bundleSignature({ ...bundle, alliances: afterRound(1, 2, 3, 4) })).toBe(before);
		expect(bundleSignature({ ...bundle, alliances: afterRound(1, 2, 3, 4, 5) })).not.toBe(before);
		expect(
			bundleSignature({
				...bundle,
				alliances: afterRound(1, 2, 3, 4),
				matches: bundle.matches.slice(0, 10)
			})
		).not.toBe(before);
		expect(
			bundleSignature({ ...bundle, alliances: afterRound(1, 2, 3, 4), phase: 'playoffs' })
		).not.toBe(before);
	});
});

describe('park averages', () => {
	it('averages park points per qualification match', () => {
		const parks = parkAverages(bundle.matches);
		expect(parks.get(14624)).toBe(7);
		expect(parks.get(36980)).toBe(8);
		expect(parks.get(26670)).toBe(6);
		expect(parks.size).toBe(27);
	});

	it('skips matches without results and teams that did not play', () => {
		const unplayed = bundle.matches.map((match) => ({ ...match, result: null }));
		expect(parkAverages(unplayed).size).toBe(0);
	});
});

function rating(team: number, opr: number, auto: number, park: number) {
	return {
		team,
		opr,
		parts: { auto, hive: 0, flower: 0, garden: 0, park, tips: 0 },
		matches: 5,
		rank: 1,
		prior: 0,
		history: []
	};
}

function option(team: number, winRound1: number, extra: Partial<PickOption> = {}): PickOption {
	return {
		team,
		opr: 30,
		auto: 10,
		tips: 2,
		park: 5,
		winRound1,
		reachUpperFinal: 0.02,
		winEvent: 0.01,
		promotesCaptain: null,
		...extra
	};
}

function analysisWith(overrides: Partial<EventAnalysis>): EventAnalysis {
	return {
		code: 'USAZGIQ',
		generatedAt: NOW,
		model: { id: 'opr', label: 'OPR' },
		ratings: [],
		forecasts: {},
		timing: { cycleSeconds: null, delaySeconds: null, onField: null, next: null, matches: {} },
		projections: null,
		strength: [],
		playoffs: null,
		picks: null,
		averages: {
			parts: { auto: 0, hive: 0, flower: 0, garden: 0, park: 0, tips: 0 },
			score: 0,
			matches: 0
		},
		...overrides
	};
}

describe('available teams table', () => {
	const state = deriveSelection(afterRound(1, 2, 3, 4));

	it('works without any analysis', () => {
		const table = selectionTable(bundle, null, state);
		expect(table).toMatchObject({ rated: false, picks: false, pickAlliance: null });
		expect(table.available).toHaveLength(18);
		expect(table.taken).toHaveLength(9);
		expect(table.available.map((row) => row.rank)).toEqual(
			[...table.available.map((row) => row.rank)].sort((a, b) => (a ?? 99) - (b ?? 99))
		);
		expect(table.available[0]).toMatchObject({
			team: 37557,
			name: 'Grape Nerds',
			rank: 8,
			rs: 3,
			tbp: 81.4,
			avgAuto: 23.8,
			avgTips: 2.6,
			avgPark: 7,
			opr: null,
			winRound1: null
		});
		expect(table.available[0].status).toEqual({ kind: 'available', captainOf: 6 });
	});

	it('lists taken teams by alliance, captain first', () => {
		const table = selectionTable(bundle, null, state);
		expect(table.taken.map((row) => row.team)).toEqual([
			26670, 18421, 18420, 25620, 21579, 26128, 15058, 15135, 14624
		]);
	});

	it('shows OPR columns once ratings exist and sorts by OPR', () => {
		const table = selectionTable(
			bundle,
			analysisWith({
				ratings: [
					rating(36980, 40, 23.3, 5),
					rating(2844, 47.4, 24.5, 7),
					rating(12841, 35.1, 9.1, 8)
				]
			}),
			state
		);
		expect(table.rated).toBe(true);
		expect(table.picks).toBe(false);
		expect(table.available.slice(0, 3).map((row) => row.team)).toEqual([2844, 36980, 12841]);
		expect(table.available[0]).toMatchObject({ opr: 47.4, autoOpr: 24.5, avgPark: 7 });
		expect(table.available[3].opr).toBeNull();
	});

	it('adds playoff chances for the alliance on the clock and sorts by round one', () => {
		const table = selectionTable(
			bundle,
			analysisWith({
				ratings: [rating(2844, 47.4, 24.5, 7)],
				picks: {
					seed: 5,
					captain: 14624,
					options: [
						option(12841, 0.6, { opr: 35.1, auto: 9.1, tips: 1.6, park: 8 }),
						option(2844, 0.76, { opr: 47.4, auto: 24.5, tips: 2.2, park: 7, winEvent: 0.05 }),
						option(37557, 0.66, { promotesCaptain: 36980 }),
						option(36980, 0.67)
					]
				}
			}),
			state
		);
		expect(table.picks).toBe(true);
		expect(table.pickAlliance).toBe(5);
		expect(table.available.slice(0, 4).map((row) => row.team)).toEqual([2844, 36980, 37557, 12841]);
		expect(table.available[0]).toMatchObject({
			winRound1: 0.76,
			reachUpperFinal: 0.02,
			winEvent: 0.05,
			opr: 47.4,
			autoOpr: 24.5,
			avgTips: 2.2,
			avgPark: 7
		});
		const captain = table.available.find((row) => row.team === 37557);
		expect(captain?.promotes).toBe(36980);
		expect(captain?.status).toEqual({ kind: 'available', captainOf: 6 });
	});

	it('ignores pick analysis made for a different alliance', () => {
		const table = selectionTable(
			bundle,
			analysisWith({
				ratings: [rating(2844, 47.4, 24.5, 7)],
				picks: { seed: 4, captain: 15058, options: [option(2844, 0.9)] }
			}),
			state
		);
		expect(table.picks).toBe(false);
		expect(table.available.find((row) => row.team === 2844)?.winRound1).toBeNull();
	});

	it('gives taken teams their ratings too', () => {
		const table = selectionTable(
			bundle,
			analysisWith({ ratings: [rating(26128, 52.8, 6.8, 8)] }),
			state
		);
		expect(table.taken.find((row) => row.team === 26128)).toMatchObject({
			opr: 52.8,
			autoOpr: 6.8,
			status: { kind: 'pick', alliance: 3 }
		});
	});

	it('lists every team once even after the selection is over', () => {
		const table = selectionTable(bundle, null, deriveSelection(finished));
		expect(table.taken).toHaveLength(12);
		expect(table.available).toHaveLength(15);
		expect(new Set([...table.taken, ...table.available].map((row) => row.team)).size).toBe(27);
	});
});

describe('chance to win the event', () => {
	const odds = (seed: number, winEvent: number): AllianceOdds => ({
		seed,
		teams: [seed * 10, seed * 10 + 1],
		strength: 0,
		winEvent,
		reachFinal: 0,
		winNext: 0
	});

	it('lists likely winners first and groups the long shots', () => {
		const rows = oddsRows([
			odds(1, 0.27),
			odds(2, 0.71),
			odds(3, 0.02),
			odds(4, 0.001),
			odds(5, 0.0004),
			odds(6, 0)
		]);
		expect(rows.map((row) => [row.label, row.chance])).toEqual([
			['Alliance 2', 0.71],
			['Alliance 1', 0.27],
			['Alliance 3', 0.02],
			['Alliances 4 to 6', 0.001]
		]);
		expect(rows[3].seeds).toEqual([4, 5, 6]);
	});

	it('keeps a single long shot on its own line', () => {
		const rows = oddsRows([odds(1, 0.6), odds(2, 0.4), odds(3, 0.001)]);
		expect(rows.map((row) => row.label)).toEqual(['Alliance 1', 'Alliance 2', 'Alliance 3']);
	});

	it('names groups of alliances', () => {
		expect(formatSeeds([4])).toBe('Alliance 4');
		expect(formatSeeds([5, 4])).toBe('Alliances 4 and 5');
		expect(formatSeeds([4, 5, 6])).toBe('Alliances 4 to 6');
		expect(formatSeeds([3, 5, 6])).toBe('Alliances 3, 5 and 6');
		expect(formatSeeds([2, 3, 4, 5])).toBe('Alliances 2 to 5');
	});
});
