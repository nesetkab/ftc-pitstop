import { describe, expect, it } from 'vitest';
import { fixtureBundle } from '#lib/components/pit/fixtures.ts';
import {
	computeRankings,
	parseReplayTime,
	replayAlliances,
	replayBundle,
	replayClock,
	replaySettings,
	replaySpeed,
	replayStart,
	selectionSteps,
	selectionWindow
} from './replay.ts';

const bundle = fixtureBundle('USAZGIQ');
const at = (label: string) => replayStart(label, bundle)!;
const phoenix = (local: string) => parseReplayTime(local, 'America/Phoenix')!;

describe('replayBundle', () => {
	it('recomputes the rankings after Q22', () => {
		const replay = replayBundle(bundle, at('Q22'));
		const table = replay.rankings.map((row) => [row.rank, row.team, row.rs.toFixed(2)]);
		expect(table.slice(0, 8)).toEqual([
			[1, 26670, '4.50'],
			[2, 18421, '4.25'],
			[3, 18420, '4.00'],
			[4, 21579, '4.00'],
			[5, 15135, '4.00'],
			[6, 15058, '3.67'],
			[7, 37557, '3.33'],
			[8, 14624, '3.33']
		]);
		expect(replay.rankings).toHaveLength(27);
		expect(replay.rankings.find((row) => row.team === 14624)).toMatchObject({
			wins: 3,
			losses: 0,
			ties: 0,
			played: 3
		});
	});

	it('hides results that were not posted yet', () => {
		const replay = replayBundle(bundle, at('Q22'));
		const posted = replay.matches.filter((match) => match.result !== null).map((m) => m.label);
		expect(posted).toHaveLength(22);
		expect(posted.at(-1)).toBe('Q22');
		expect(replay.matches.find((match) => match.key === 'q23')).toMatchObject({
			result: null,
			actualTime: null,
			postedTime: null
		});
		expect(replay.matches.every((match) => match.level === 'qual')).toBe(true);
		expect(replay).toMatchObject({ phase: 'quals', alliances: [], awards: [], advancement: null });
		expect(replay.fetchedAt).toBe(at('Q22'));
	});

	it('matches the official rankings once every qualification match is in', () => {
		const ranked = computeRankings(
			bundle.matches,
			bundle.teams.map((team) => team.number)
		);
		const official = bundle.rankings.map((row) => [row.rank, row.team, row.rs.toFixed(2)]);
		expect(ranked.map((row) => [row.rank, row.team, row.rs.toFixed(2)])).toEqual(official);
		const top = ranked[0];
		expect(top.tbp).toBeCloseTo(bundle.rankings[0].tbp, 5);
		expect(top.avgTips).toBeCloseTo(bundle.rankings[0].avgTips, 5);
		expect(top.avgAuto).toBeCloseTo(bundle.rankings[0].avgAuto, 5);
	});

	it.each(['USMISOQ', 'USALATQ', 'UZTAQ1', 'KZASN2', 'USCALACAS1'])(
		'matches the official %s rankings',
		(code) => {
			const event = fixtureBundle(code);
			const ranked = computeRankings(
				event.matches,
				event.teams.map((team) => team.number)
			).filter((row) => row.played > 0);
			const view = (rows: typeof event.rankings) =>
				rows.map((row) => [row.rank, row.team, row.rs.toFixed(2), row.wins, row.losses, row.ties]);
			expect(view(ranked)).toEqual(view(event.rankings.filter((row) => row.played > 0)));
		}
	);

	it('skips surrogate appearances', () => {
		const q15 = bundle.matches.find((match) => match.key === 'q15')!;
		expect(q15.red.find((slot) => slot.team === 15135)?.surrogate).toBe(true);
		const ranked = computeRankings(bundle.matches);
		expect(ranked.find((row) => row.team === 15135)).toMatchObject({
			played: 5,
			wins: 4,
			losses: 1
		});
		const afterQ22 = replayBundle(bundle, at('Q22')).rankings.find((row) => row.team === 15135);
		expect(afterQ22).toMatchObject({ played: 2, wins: 2, losses: 0 });
	});

	it('is upcoming before the first match starts', () => {
		const replay = replayBundle(bundle, phoenix('2026-11-14T10:00'));
		expect(replay.phase).toBe('upcoming');
		expect(replay.rankings).toEqual([]);
		expect(replay.matches.some((match) => match.actualTime !== null)).toBe(false);
	});

	it('shows a match on the field after it starts and before it is posted', () => {
		const replay = replayBundle(bundle, phoenix('2026-11-14T13:44:00'));
		const q23 = replay.matches.find((match) => match.key === 'q23')!;
		expect(q23.actualTime).not.toBeNull();
		expect(q23.result).toBeNull();
	});

	it('reveals alliance picks one at a time during selection', () => {
		const window = selectionWindow(bundle)!;
		const q34 = bundle.matches.find((match) => match.key === 'q34')!;
		expect(window.start).toBe(q34.postedTime! + 10 * 60_000);
		expect(window.end).toBe(phoenix('2026-11-14T15:20'));
		const before = replayBundle(bundle, window.start - 1000);
		expect(before).toMatchObject({ phase: 'selection', alliances: [] });
		const middle = replayBundle(bundle, (window.start + window.end) / 2);
		expect(middle.phase).toBe('selection');
		expect(middle.alliances.map((alliance) => alliance.picks.length)).toEqual([1, 1, 1, 0]);
		expect(middle.matches.some((match) => match.level === 'playoff')).toBe(false);
		const after = replayBundle(bundle, window.end);
		expect(after.alliances).toEqual(bundle.alliances);
		expect(after.phase).toBe('playoffs');
	});

	it('adds each side of a playoff match once its alliance is known', () => {
		const sides = (time: number) =>
			replayBundle(bundle, time)
				.matches.filter((match) => match.level === 'playoff')
				.map((match) => `${match.label} ${match.red.length}-${match.blue.length}`);
		const window = selectionWindow(bundle)!;
		expect(sides(window.end)).toEqual(['M1 2-2', 'M2 2-2', 'M3 2-0', 'M4 2-0']);
		expect(sides(at('M1'))).toEqual(['M1 2-2', 'M2 2-2', 'M3 2-2', 'M4 2-0', 'M6 0-2']);
		expect(sides(at('M3')).slice(-3)).toEqual(['M5 2-2', 'M6 0-2', 'M7 2-0']);
		expect(sides(at('M7')).slice(-2)).toEqual(['M9 2-0', 'M10 2-0']);
		expect(sides(at('M10'))).toHaveLength(10);
	});

	it('plays out the playoffs and ends with the awards', () => {
		const playoffs = replayBundle(bundle, at('M5'));
		expect(playoffs.phase).toBe('playoffs');
		expect(
			playoffs.matches
				.filter((match) => match.result)
				.map((m) => m.label)
				.slice(-2)
		).toEqual(['M4', 'M5']);
		const decided = replayBundle(bundle, at('M10'));
		expect(decided.phase).toBe('done');
		expect(decided.awards).toEqual([]);
		const later = replayBundle(bundle, at('M10') + 20 * 60_000);
		expect(later.awards).toEqual(bundle.awards);
		expect(later.advancement).toEqual(bundle.advancement);
	});
});

describe('selection order', () => {
	it('snakes the second round', () => {
		const alliances = [1, 2, 3].map((seed) => ({
			seed,
			name: `Alliance ${seed}`,
			captain: seed * 100,
			picks: [seed * 100 + 1, seed * 100 + 2],
			backup: null,
			backupReplaced: null
		}));
		expect(selectionSteps(alliances)).toEqual([
			{ seed: 1, round: 1 },
			{ seed: 2, round: 1 },
			{ seed: 3, round: 1 },
			{ seed: 3, round: 2 },
			{ seed: 2, round: 2 },
			{ seed: 1, round: 2 }
		]);
		const window = { start: 0, end: 6000 };
		expect(replayAlliances(alliances, window, 3500).map((a) => a.picks)).toEqual([
			[101],
			[201],
			[301]
		]);
		expect(replayAlliances(alliances, window, 4000).map((a) => a.picks)).toEqual([
			[101],
			[201],
			[301, 302]
		]);
		expect(replayAlliances(alliances, null, 4000)).toEqual([]);
	});
});

describe('replay settings', () => {
	it('reads match labels and times in the event time zone', () => {
		expect(at('Q22')).toBe(bundle.matches.find((m) => m.key === 'q22')!.postedTime! + 60_000);
		expect(at('q22')).toBe(at('Q22'));
		expect(replayStart('2026-11-14T13:41:00-07:00', bundle)).toBe(
			Date.parse('2026-11-14T20:41:00Z')
		);
		expect(replayStart('2026-11-14T13:41', bundle)).toBe(Date.parse('2026-11-14T20:41:00Z'));
		expect(replayStart('2026-11-14 13:41:00', bundle)).toBe(Date.parse('2026-11-14T20:41:00Z'));
		expect(replayStart('Q99', bundle)).toBeNull();
		expect(replayStart('lunch', bundle)).toBeNull();
	});

	it('handles daylight saving time zones', () => {
		expect(parseReplayTime('2026-07-04T12:00', 'America/New_York')).toBe(
			Date.parse('2026-07-04T16:00:00Z')
		);
		expect(parseReplayTime('2026-12-04T12:00', 'America/New_York')).toBe(
			Date.parse('2026-12-04T17:00:00Z')
		);
	});

	it('needs the replay flag and falls back to before the first match', () => {
		expect(replaySettings(new URLSearchParams('at=Q22'), bundle)).toBeNull();
		expect(replaySettings(new URLSearchParams('replay=0&at=Q22'), bundle)).toBeNull();
		expect(replaySettings(new URLSearchParams('replay=1&at=Q22&speed=10'), bundle)).toEqual({
			start: at('Q22'),
			speed: 10
		});
		const first = bundle.matches[0].scheduledTime!;
		expect(replaySettings(new URLSearchParams('replay=1'), bundle)).toEqual({
			start: first - 30 * 60_000,
			speed: 1
		});
	});

	it('runs the replay clock at the chosen speed', () => {
		expect(replaySpeed('10')).toBe(10);
		expect(replaySpeed('-2')).toBe(1);
		expect(replaySpeed('fast')).toBe(1);
		expect(replaySpeed('100000')).toBe(600);
		const settings = { start: 1_000_000, speed: 10 };
		expect(replayClock(settings, 5000, 8000)).toBe(1_030_000);
		expect(replayClock(settings, 5000, 4000)).toBe(1_000_000);
	});
});
