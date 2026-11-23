import { describe, expect, it } from 'vitest';
import type { EventAnalysis } from '#lib/analysis/types.ts';
import { fixtureBundle } from '#lib/components/pit/fixtures.ts';
import { withoutBreakdowns } from '#lib/game/breakdowns.ts';
import { replayBundle, replayStart, selectionWindow } from '#lib/game/replay.ts';
import type { EventBundle, QueueMatch, QueueStatusSnapshot } from '#lib/types.ts';
import {
	analysisBehind,
	LAYOUT_LAG,
	needsReload,
	nextBaseline,
	nowView,
	rankSnapshot,
	RELOAD_GAP,
	resultTags,
	UPCOMING_COUNT,
	type RankSnapshot
} from './now.ts';
import { fakeAnalysis } from './test-fixtures.ts';

const full = fixtureBundle('USAZGIQ');
const analysis = fakeAnalysis(full);
const at = (label: string) => replayStart(label, full)!;
const window = selectionWindow(full)!;
const firstMatch = full.matches[0].scheduledTime!;

function viewAt(time: number, options: Partial<Parameters<typeof nowView>[0]> = {}) {
	return nowView({
		bundle: replayBundle(full, time),
		analysis,
		queue: null,
		baseline: null,
		now: time,
		...options
	});
}

function queueMatch(label: string, status: QueueMatch['status'], start: number): QueueMatch {
	return {
		label,
		key: label.toLowerCase(),
		status,
		red: [],
		blue: [],
		times: {
			scheduledStart: null,
			estimatedQueue: null,
			estimatedOnDeck: null,
			estimatedOnField: null,
			estimatedStart: start,
			actualQueue: null,
			actualOnDeck: null,
			actualOnField: null,
			actualStart: null,
			actualCommit: null
		},
		breakAfter: null,
		replayOf: null
	};
}

describe('nowView before matches start', () => {
	const view = viewAt(firstMatch - 10 * 60_000);

	it('lists the first matches with their scheduled times and forecasts', () => {
		expect(view.phase).toBe('upcoming');
		expect(view.onField).toBeNull();
		expect(view.upcoming).toHaveLength(UPCOMING_COUNT);
		expect(view.upcoming[0]).toMatchObject({
			label: 'Q1',
			red: [26670, 32043],
			blue: [26128, 38444],
			scheduled: firstMatch,
			expected: firstMatch
		});
		expect(view.upcoming[0].forecast).toBe(analysis.forecasts.q1);
		expect(view.startsAt).toBe(firstMatch);
	});

	it('has nothing to report on timing, results or standings yet', () => {
		expect(view.delaySeconds).toBeNull();
		expect(view.results).toEqual([]);
		expect(view.standings).toEqual([]);
		expect(view.selection).toBeNull();
		expect(view.playoffs).toEqual([]);
	});
});

describe('nowView during quals', () => {
	const time = at('Q22');
	const view = viewAt(time);

	it('shows the next matches with estimates from the live timing', () => {
		expect(view.phase).toBe('quals');
		expect(view.upcoming.map((match) => match.label)).toEqual(['Q23', 'Q24', 'Q25', 'Q26', 'Q27']);
		const q23 = view.upcoming[0];
		expect(q23.expected).toBeGreaterThan(q23.scheduled!);
		expect(view.delaySeconds).toBe(Math.round((q23.expected! - q23.scheduled!) / 1000));
	});

	it('lists the latest results newest first', () => {
		expect(view.results.map((result) => result.label)).toEqual(['Q22', 'Q21', 'Q20', 'Q19', 'Q18']);
		expect(view.results[0]).toMatchObject({
			redScore: 45,
			blueScore: 97,
			winner: 'blue',
			chance: analysis.forecasts.q22.blue.win
		});
		expect(view.qualsPlayed).toBe(22);
		expect(view.qualsTotal).toBe(34);
		expect(view.rankedAfter).toBe('Q22');
	});

	it('shows the top 8 with names and no movement before a second update', () => {
		expect(view.standings).toHaveLength(8);
		expect(view.standings[0]).toMatchObject({ rank: 1, team: 26670, move: null });
		expect(view.standings.every((row) => row.name !== null)).toBe(true);
		expect(view.since).toBeNull();
	});

	it('works without any analysis', () => {
		const bare = viewAt(time, { analysis: null });
		expect(bare.upcoming[0].forecast).toBeNull();
		expect(bare.upcoming[0].expected).toBeNull();
		expect(bare.results[0].chance).toBeNull();
		expect(bare.delaySeconds).toBe(142);
	});

	it('takes the field and estimates from Nexus when the event uses it', () => {
		const queue: QueueStatusSnapshot = {
			eventKey: 'USAZGIQ',
			dataAsOfTime: time,
			nowQueuing: 'Q25',
			matches: [
				queueMatch('Q23', 'on-field', time),
				queueMatch('Q24', 'on-deck', time + 6 * 60_000),
				queueMatch('Q25', 'queuing-soon', time + 12 * 60_000)
			],
			announcements: []
		};
		const live = viewAt(time, { queue });
		expect(live.onField).toMatchObject({ label: 'Q23', status: 'on-field' });
		expect(live.upcoming.map((match) => [match.label, match.status])).toEqual([
			['Q24', 'on-deck'],
			['Q25', 'now-queuing'],
			['Q26', null],
			['Q27', null],
			['Q28', null]
		]);
		expect(live.upcoming[0].expected).toBe(time + 6 * 60_000);
	});

	it('treats a started match without a score as on the field', () => {
		const bundle = replayBundle(full, time);
		const started: EventBundle = {
			...bundle,
			matches: bundle.matches.map((match) =>
				match.key === 'q23' ? { ...match, actualTime: time } : match
			)
		};
		const live = nowView({ bundle: started, analysis, queue: null, baseline: null, now: time });
		expect(live.onField).toMatchObject({
			label: 'Q23',
			status: 'playing',
			expected: null,
			started: time
		});
		expect(live.upcoming[0].label).toBe('Q24');
	});
});

describe('rank movement between updates', () => {
	const before = replayBundle(full, at('Q21'));
	const after = replayBundle(full, at('Q22'));

	it('keeps the last different snapshot as the baseline', () => {
		const first = rankSnapshot(before);
		const second = rankSnapshot(after);
		expect(first?.after).toBe('Q21');
		expect(nextBaseline(null, null, first)).toBeNull();
		expect(nextBaseline(null, first, first)).toBeNull();
		expect(nextBaseline(null, first, second)).toBe(first);
		expect(nextBaseline(first, second, second)).toBe(first);
		expect(rankSnapshot({ matches: before.matches, rankings: [] })).toBeNull();
	});

	it('reports moves against the baseline during quals', () => {
		const baseline = rankSnapshot(before)!;
		const view = viewAt(at('Q22'), { baseline });
		expect(view.since).toBe('Q21');
		for (const row of view.standings) {
			expect(row.move).toBe(baseline.ranks[row.team] - row.rank);
		}
		expect(view.standings.some((row) => row.move !== 0)).toBe(true);
	});

	it('ignores movement once playoffs start', () => {
		const baseline: RankSnapshot = { after: 'Q33', ranks: { 26670: 3 } };
		const view = viewAt(at('M1'), { baseline });
		expect(view.standings[0].move).toBeNull();
		expect(view.since).toBeNull();
	});
});

describe('result labels', () => {
	const score = (red: number, blue: number) => ({
		red: { total: red, preFoulTotal: red, auto: 0, teleop: 0, foulPoints: 0, breakdown: null },
		blue: { total: blue, preFoulTotal: blue, auto: 0, teleop: 0, foulPoints: 0, breakdown: null },
		winner: red > blue ? ('red' as const) : red < blue ? ('blue' as const) : null
	});

	it('marks underdog wins, close games and ties', () => {
		expect(resultTags(score(80, 60), 0.3)).toEqual(['upset']);
		expect(resultTags(score(80, 60), 0.6)).toEqual([]);
		expect(resultTags(score(80, 76), 0.6)).toEqual(['close']);
		expect(resultTags(score(150, 143), 0.7)).toEqual(['close']);
		expect(resultTags(score(150, 140), 0.7)).toEqual([]);
		expect(resultTags(score(61, 58), 0.2)).toEqual(['upset', 'close']);
		expect(resultTags(score(50, 50), 0.2)).toEqual(['tie']);
		expect(resultTags(score(80, 60), null)).toEqual([]);
	});

	it('uses the pre-match forecast for the winner', () => {
		const flipped: EventAnalysis = {
			...analysis,
			forecasts: {
				...analysis.forecasts,
				q22: {
					...analysis.forecasts.q22,
					red: { ...analysis.forecasts.q22.red, win: 0.8 },
					blue: { ...analysis.forecasts.q22.blue, win: 0.2 }
				}
			}
		};
		const view = viewAt(at('Q22'), { analysis: flipped });
		expect(view.results[0]).toMatchObject({ label: 'Q22', chance: 0.2, tags: ['upset'] });
	});
});

describe('nowView during alliance selection', () => {
	it('says selection is next before any captain is called', () => {
		const view = viewAt(window.start - 60_000);
		expect(view.phase).toBe('selection');
		expect(view.upcoming).toEqual([]);
		expect(view.delaySeconds).toBeNull();
		expect(view.selection).toEqual({ state: 'next', spots: 6, picking: null, alliances: [] });
	});

	it('names the alliance that is picking', () => {
		const view = viewAt((window.start + window.end) / 2);
		expect(view.selection?.state).toBe('picking');
		expect(view.selection?.picking).toBe(4);
		expect(view.selection?.alliances.map((alliance) => alliance.seed)).toEqual([1, 2, 3, 4]);
	});

	it('is done once every alliance has its pick', () => {
		const bundle: EventBundle = { ...replayBundle(full, window.start), alliances: full.alliances };
		const view = nowView({ bundle, analysis, queue: null, baseline: null, now: window.start });
		expect(view.selection).toMatchObject({ state: 'done', picking: null, spots: 6 });
	});
});

describe('nowView during playoffs', () => {
	const view = viewAt(at('M1'));

	it('lists the next bracket matches with undecided sides', () => {
		expect(view.phase).toBe('playoffs');
		expect(view.selection).toBeNull();
		expect(view.upcoming.map((match) => match.label)).toEqual(['M2', 'M3', 'M4', 'M6']);
		expect(view.upcoming[2]).toMatchObject({
			red: [18420, 25620],
			blue: [],
			pending: { red: null, blue: 'Winner of M2' },
			forecast: null
		});
		expect(view.results[0].label).toBe('M1');
	});

	it('shows each alliance record and chance to win', () => {
		expect(view.playoffs.map((entry) => [entry.seed, entry.wins, entry.losses])).toEqual([
			[1, 0, 0],
			[2, 0, 0],
			[3, 0, 0],
			[4, 0, 1],
			[5, 1, 0],
			[6, 0, 0]
		]);
		expect(view.playoffs[0].winEvent).toBe(0.55);
		const later = viewAt(at('M5'));
		expect(later.playoffs.find((entry) => entry.seed === 5)).toMatchObject({
			out: true,
			winEvent: null
		});
	});
});

describe('nowView when the event is done', () => {
	const view = nowView({ bundle: full, analysis, queue: null, baseline: null, now: Date.now() });

	it('names the champion and stops looking ahead', () => {
		expect(view.phase).toBe('done');
		expect(view.onField).toBeNull();
		expect(view.upcoming).toEqual([]);
		expect(view.delaySeconds).toBeNull();
		expect(view.champion).toMatchObject({ seed: 2, teams: [18420, 25620], won: true });
		expect(view.results[0].label).toBe('M10');
	});
});

describe('reloading the event data', () => {
	const shown = withoutBreakdowns(replayBundle(full, at('Q21')));
	const latest = withoutBreakdowns(replayBundle(full, at('Q22')));
	const now = at('Q22');
	const base = { shown, latest: shown, analysis, now, lastReload: now - RELOAD_GAP };

	it('reloads when a new result lands, at most every so often', () => {
		expect(needsReload({ ...base, latest })).toBe(true);
		expect(needsReload({ ...base, latest, lastReload: now - 1000 })).toBe(false);
		expect(needsReload(base)).toBe(false);
	});

	it('reloads when the analysis has not caught up with the results', () => {
		const stale: EventAnalysis = {
			...analysis,
			forecasts: { ...analysis.forecasts, q21: { ...analysis.forecasts.q21, played: false } }
		};
		expect(analysisBehind(stale, shown)).toBe(true);
		expect(analysisBehind(analysis, shown)).toBe(false);
		expect(analysisBehind(null, shown)).toBe(false);
		expect(needsReload({ ...base, analysis: stale })).toBe(true);
	});

	it('reloads when the header has fallen well behind the live data', () => {
		const newer = { ...shown, fetchedAt: shown.fetchedAt + LAYOUT_LAG + 1 };
		expect(needsReload({ ...base, latest: newer })).toBe(true);
		expect(needsReload({ ...base, latest: { ...shown, fetchedAt: shown.fetchedAt + 1000 } })).toBe(
			false
		);
	});
});
