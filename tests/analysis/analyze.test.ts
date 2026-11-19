import { describe, expect, it } from 'vitest';
import { analyzeEvent, MODEL } from '#lib/analysis/analyze.ts';
import { toModelEvent } from '#lib/analysis/convert.ts';
import type { EventAnalysis, MatchForecast } from '#lib/analysis/types.ts';
import { rateSeason } from '#lib/model/opr.ts';
import type { ModelEvent } from '#lib/model/types.ts';
import type { EventBundle } from '#lib/types.ts';
import modelFixture from '../fixtures/model/USAZGIQ.json';
import { bundleFor, contexts, cutAfterQual, cutPlayoffs } from './helpers.ts';

const inUnit = (p: number) => p >= 0 && p <= 1;

function expectSaneForecast(f: MatchForecast) {
	for (const side of [f.red, f.blue]) {
		expect([side.win, side.rp.win, side.rp.swarm, side.rp.pollinator1].every(inUnit)).toBe(true);
		expect(side.rp.pollinator2).toBeLessThanOrEqual(side.rp.pollinator1);
		expect(side.score).toBeGreaterThan(0);
		expect(side.sd).toBeGreaterThan(0);
	}
	expect(f.red.win + f.blue.win + f.tie).toBeCloseTo(1, 3);
}

function expectRanksConsistent(analysis: EventAnalysis) {
	const ranks = analysis.ratings.map((r) => r.rank);
	expect(ranks).toEqual(ranks.map((_, i) => i + 1));
	for (let i = 1; i < analysis.ratings.length; i++)
		expect(analysis.ratings[i - 1].opr).toBeGreaterThanOrEqual(analysis.ratings[i].opr);
}

function run(bundle: EventBundle, code = bundle.event.code, now = Date.parse('2026-11-19T12:00:00Z')) {
	return analyzeEvent(bundle, contexts[code], { now });
}

describe('analyzeEvent on the finished Gilbert qualifier', async () => {
	const bundle = await bundleFor('USAZGIQ');
	const analysis = run(bundle);

	it('rates every team and keeps ranks consistent with OPR', () => {
		expect(analysis.model).toEqual(MODEL);
		expect(analysis.ratings).toHaveLength(27);
		expectRanksConsistent(analysis);
		for (const r of analysis.ratings) {
			expect(r.history).toHaveLength(r.matches);
			expect(r.sd).toBeGreaterThan(0);
			const sum = r.parts.auto + r.parts.hive + r.parts.flower + r.parts.garden + r.parts.park;
			expect(sum).toBeCloseTo(r.opr, 0);
		}
	});

	it('forecasts every match from what was known before it', () => {
		expect(Object.keys(analysis.forecasts)).toHaveLength(44);
		const forecasts = Object.values(analysis.forecasts);
		forecasts.forEach(expectSaneForecast);
		expect(forecasts.every((f) => f.played)).toBe(true);
		const graded = forecasts.filter((f) => f.correct !== null);
		expect(graded.length).toBeGreaterThan(40);
		expect(graded.filter((f) => f.correct).length / graded.length).toBeGreaterThan(0.6);
	});

	it('matches the official ranking score in schedule strength', () => {
		expect(analysis.projections).toBeNull();
		expect(analysis.picks).toBeNull();
		const official = new Map(bundle.rankings.map((r) => [r.team, r.rs]));
		expect(analysis.strength).toHaveLength(official.size);
		for (const s of analysis.strength) {
			expect(s.actualRs).toBeCloseTo(official.get(s.team)!, 2);
			expect(s.ratingRank).toBe(analysis.ratings.find((r) => r.team === s.team)!.rank);
			expect(s.expectedRs).toBeGreaterThan(0);
		}
	});

	it('settles the playoff odds on the real champion', () => {
		const odds = analysis.playoffs!;
		expect(odds).toHaveLength(6);
		expect(odds.reduce((s, o) => s + o.winEvent, 0)).toBeCloseTo(1, 6);
		const champion = odds.find((o) => o.teams.includes(18420))!;
		expect(champion).toMatchObject({ seed: 2, winEvent: 1, reachFinal: 1, winNext: 0 });
		expect(odds.find((o) => o.seed === 1)!.reachFinal).toBe(1);
		expect(odds.every((o) => o.strength > 0)).toBe(true);
	});

	it('reports averages and finished timing', () => {
		const { parts, score, matches } = analysis.averages;
		expect(matches).toBe(44);
		expect(parts.auto + parts.hive + parts.flower + parts.garden + parts.park).toBeCloseTo(score, 0);
		expect(analysis.timing.next).toBeNull();
		expect(analysis.timing.onField).toBeNull();
		expect(analysis.timing.cycleSeconds).toBeGreaterThan(60);
		const q1 = analysis.timing.matches.q1;
		expect(q1).toMatchObject({ matchesAway: null, queueAt: null });
		expect(q1.expectedStart).toBe(bundle.matches.find((m) => m.key === 'q1')!.actualTime);
	});

	it('converts matches the same way the backtest did', () => {
		const ours = rateSeason([toModelEvent(bundle)]).events.get('USAZGIQ')!;
		const theirs = rateSeason([modelFixture.event as ModelEvent]).events.get('USAZGIQ')!;
		expect(ours.steps.map((s) => s.key)).toEqual(theirs.steps.map((s) => s.key));
		for (const r of theirs.ratings) {
			expect(ours.rater.value(r.team)).toBeCloseTo(r.opr, 6);
			expect(ours.rater.value(r.team, 'strength')).toBeCloseTo(r.strength, 6);
			expect(ours.rater.value(r.team, 'tips')).toBeCloseTo(r.components.tips, 6);
		}
	});
});

describe('replaying Gilbert after Q22', async () => {
	const full = run(await bundleFor('USAZGIQ'));
	const live = await bundleFor('USAZGIQ');
	const q22 = live.matches.find((m) => m.key === 'q22')!;
	const now = q22.actualTime! + 4 * 60_000;
	const bundle = cutAfterQual(live, 22);
	const analysis = run(bundle, 'USAZGIQ', now);

	it('gives 14624 a forecast and a time for Q26', () => {
		const q26 = bundle.matches.find((m) => m.key === 'q26')!;
		expect([...q26.red, ...q26.blue].map((t) => t.team)).toContain(14624);
		const forecast = analysis.forecasts.q26;
		expect(forecast).toMatchObject({ played: false, correct: null });
		expectSaneForecast(forecast);
		const timing = analysis.timing.matches.q26;
		expect(timing.matchesAway).toBe(3);
		expect(timing.expectedStart!).toBeGreaterThan(now);
		expect(timing.queueAt!).toBeLessThan(timing.expectedStart!);
		expect(analysis.timing).toMatchObject({ next: 'q23', onField: null });
	});

	it('keeps forecasts for played matches identical to the full event', () => {
		for (let n = 1; n <= 22; n++) expect(analysis.forecasts[`q${n}`]).toEqual(full.forecasts[`q${n}`]);
	});

	it('projects the final rankings', () => {
		const rows = analysis.projections!;
		expect(rows).toHaveLength(27);
		for (const row of rows) {
			expect(row.rankChances.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 3);
			expect(row.top4).toBeLessThanOrEqual(row.top8);
			expect(row.expectedRank).toBeGreaterThanOrEqual(1);
			expect(row.expectedRank).toBeLessThanOrEqual(27);
		}
		for (let rank = 0; rank < 27; rank++)
			expect(rows.reduce((s, row) => s + row.rankChances[rank], 0)).toBeCloseTo(1, 3);
		expect(analysis.playoffs).toBeNull();
		expect(analysis.picks).toBeNull();
	});

	it('shows the match on the field once it starts', () => {
		const started = {
			...bundle,
			matches: bundle.matches.map((m) => (m.key === 'q23' ? { ...m, actualTime: now } : m))
		};
		const timing = run(started, 'USAZGIQ', now + 60_000).timing;
		expect(timing).toMatchObject({ onField: 'q23', next: 'q24' });
		expect(timing.matches.q26.matchesAway).toBe(3);
		expect(timing.matches.q23.matchesAway).toBe(0);
	});
});

describe('playoff odds', async () => {
	it('handles a two alliance final', async () => {
		const done = await bundleFor('USALATQ');
		const final = run(done).playoffs!;
		expect(final.map((o) => o.winEvent)).toEqual([1, 0]);
		const afterOne = run(cutPlayoffs(done, (m) => m.number === 1)).playoffs!;
		expect(afterOne[0].winEvent + afterOne[1].winEvent).toBeCloseTo(1, 6);
		expect(afterOne[0].winEvent).toBeGreaterThan(afterOne[1].winEvent);
		expect(afterOne[0].winEvent).toBeLessThan(1);
		expect(afterOne[0].winNext + afterOne[1].winNext).toBeCloseTo(1, 3);
		expect(afterOne.every((o) => o.reachFinal === 1)).toBe(true);
	});

	it('handles a four alliance bracket mid way', async () => {
		const done = await bundleFor('UZTAQ1');
		expect(run(done).playoffs!.find((o) => o.seed === 1)!.winEvent).toBe(1);
		const odds = run(cutPlayoffs(done, (m) => m.series <= 3)).playoffs!;
		expect(odds).toHaveLength(4);
		expect(odds.reduce((s, o) => s + o.winEvent, 0)).toBeCloseTo(1, 6);
		expect(odds.find((o) => o.seed === 2)).toMatchObject({ winEvent: 0, winNext: 0 });
		const one = odds.find((o) => o.seed === 1)!;
		const three = odds.find((o) => o.seed === 3)!;
		expect(one.winNext + three.winNext).toBeCloseTo(1, 3);
		const fresh = run(cutPlayoffs(done, () => false)).playoffs!;
		expect(fresh.reduce((s, o) => s + o.reachFinal, 0)).toBeCloseTo(2, 6);
		expect(fresh.every((o) => o.winNext > 0 && o.winNext < 1)).toBe(true);
	});
});

describe('alliance selection', async () => {
	const done = await bundleFor('USAZGIQ');
	const selection: EventBundle = {
		...done,
		matches: done.matches.filter((m) => m.level === 'qual'),
		alliances: [],
		awards: [],
		advancement: null,
		phase: 'selection'
	};
	const ranking = [...done.rankings].sort((a, b) => a.rank - b.rank).map((r) => r.team);

	it('ranks picks for the first captain', () => {
		const picks = run(selection).picks!;
		expect(picks).toMatchObject({ seed: 1, captain: ranking[0] });
		expect(picks.options).toHaveLength(ranking.length - 1);
		expect(picks.options.map((o) => o.team)).not.toContain(ranking[0]);
		for (let i = 1; i < picks.options.length; i++)
			expect(picks.options[i - 1].winEvent).toBeGreaterThanOrEqual(picks.options[i].winEvent);
		for (const o of picks.options) {
			expect([o.winRound1, o.reachUpperFinal, o.winEvent].every(inUnit)).toBe(true);
			const future = ranking.slice(1, 6).includes(o.team);
			expect(o.promotesCaptain).toBe(future ? ranking[6] : null);
		}
		expect(run(selection).playoffs).toBeNull();
	});

	it('continues once the first alliances are formed', () => {
		const partial = { ...selection, alliances: done.alliances.slice(0, 2) };
		const picks = run(partial).picks!;
		const taken = new Set(done.alliances.slice(0, 2).flatMap((a) => [a.captain, ...a.picks]));
		expect(picks.seed).toBe(3);
		expect(picks.captain).toBe(ranking.find((t) => !taken.has(t)));
		expect(picks.options.some((o) => taken.has(o.team))).toBe(false);
	});
});

describe('an upcoming event without a schedule', async () => {
	const bundle = await bundleFor('USMTBUQ');
	const analysis = run(bundle);

	it('rates registered teams from their priors only', async () => {
		expect(bundle.phase).toBe('upcoming');
		expect(analysis.ratings).toHaveLength(bundle.teams.length);
		expectRanksConsistent(analysis);
		expect(analysis.ratings.every((r) => r.matches === 0 && r.history.length === 0)).toBe(true);
		expect(analysis.ratings.every((r) => r.opr === r.prior && r.opr > 0)).toBe(true);
		const played = run(await bundleFor('USAZGIQ')).ratings.map((r) => r.sd!);
		expect(Math.min(...analysis.ratings.map((r) => r.sd!))).toBeGreaterThan(Math.max(...played));
		const known = Object.keys(contexts.USMTBUQ.previous).length;
		expect(known).toBeGreaterThan(0);
		expect(new Set(analysis.ratings.map((r) => r.opr)).size).toBeGreaterThan(1);
		expect(analysis).toMatchObject({
			forecasts: {},
			projections: null,
			strength: [],
			playoffs: null,
			picks: null,
			averages: { matches: 0, score: 0 }
		});
		expect(analysis.timing).toMatchObject({ next: null, onField: null, matches: {} });
	});
});

describe('speed', async () => {
	const bundle = await bundleFor('USAZGIQ');
	const replay = cutAfterQual(bundle, 22);

	it('analyzes Gilbert well under half a second', () => {
		run(bundle);
		let start = performance.now();
		run(bundle);
		expect(performance.now() - start).toBeLessThan(500);
		start = performance.now();
		run(replay, 'USAZGIQ', replay.matches.find((m) => m.key === 'q22')!.actualTime!);
		expect(performance.now() - start).toBeLessThan(500);
	});
});
