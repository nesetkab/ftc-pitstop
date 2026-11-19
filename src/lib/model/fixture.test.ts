import { describe, expect, it } from 'vitest';
import fixture from '../../../tests/fixtures/model/USAZGIQ.json';
import { resolveBracket, type Color } from './bracket.ts';
import { rateSeason } from './opr.ts';
import { predictMatch } from './predict.ts';
import { estimateStarts } from './schedule.ts';
import { simulateRankings, tallyResults } from './simulate.ts';
import type { ModelEvent } from './types.ts';

const event = fixture.event as ModelEvent;

describe('Gilbert qualifier 2026 (USAZGIQ)', () => {
	it('reproduces the official ranking score and TBP for every team', () => {
		const tally = new Map(tallyResults(event.matches).map((t) => [t.team, t]));
		expect(tally.size).toBe(fixture.rankings.length);
		for (const r of fixture.rankings) {
			const t = tally.get(r.team)!;
			expect(t.counted).toBe(r.played);
			expect(t.rp / t.counted).toBeCloseTo(r.rs, 9);
			expect(t.np / t.counted).toBeCloseTo(r.tbp, 9);
		}
	});

	it('reproduces the official rank order', () => {
		const projections = simulateRankings(
			{
				teams: fixture.rankings.map((r) => r.team),
				current: tallyResults(event.matches),
				remaining: []
			},
			{ sims: 20 }
		);
		const order = [...projections]
			.sort((a, b) => a.expectedRank - b.expectedRank)
			.map((p) => p.team);
		expect(order).toEqual(fixture.rankings.map((r) => r.team));
	});

	it('rebuilds the real playoff bracket', () => {
		const results: Record<number, Color> = {};
		for (const m of event.matches.filter((x) => x.level === 'playoff')) {
			results[m.series!] = m.redScore! > m.blueScore! ? 'red' : 'blue';
		}
		const state = resolveBracket(6, results);
		const teams = (a: number | null) => (a === null ? [] : fixture.alliances[a - 1]);
		for (const m of event.matches.filter((x) => x.level === 'playoff')) {
			const r = state.matches.find((x) => x.match === m.series)!;
			expect(teams(r.redAlliance)).toEqual(m.red);
			expect(teams(r.blueAlliance)).toEqual(m.blue);
		}
		expect(teams(state.champion)).toEqual([18420, 25620]);
		expect(state.matches.find((x) => x.match === 11)!.needed).toBe(false);
	});

	it('keeps the recorded ratings and forecasts', () => {
		const ev = rateSeason([event]).events.get('USAZGIQ')!;
		expect(ev.steps).toHaveLength(44);
		const top = [...ev.ratings].sort((a, b) => b.opr - a.opr).slice(0, 3);
		expect(top.map((r) => r.team)).toEqual([18420, 25620, 18421]);
		expect(top[0].opr).toBeCloseTo(64.77, 2);
		expect(top[0].strength).toBeCloseTo(62.22, 2);
		expect(top[0].components.tips).toBeCloseTo(2.582, 3);
		const final = predictMatch(ev.steps.find((s) => s.key === 'p10')!.forecast);
		expect(final.redWin).toBeCloseTo(0.6588, 4);
		expect(final.red.score).toBeCloseTo(105.16, 2);
	});

	it('estimates the first match after lunch at its scheduled time', () => {
		const quals = event.matches
			.filter((m) => m.level === 'qual')
			.sort((a, b) => a.number! - b.number!)
			.map((m) => ({
				key: m.key,
				scheduled: m.scheduledTime ?? null,
				actual: m.actualTime ?? null
			}));
		const snapshot = quals.map((m, i) => (i < 16 ? m : { ...m, actual: null }));
		const est = estimateStarts(snapshot, { now: quals[15].actual! });
		expect(est[16].start).toBe(quals[16].scheduled);
		expect(Math.abs(est[17].start - quals[17].actual!)).toBeLessThan(6 * 60_000);
	});
});
