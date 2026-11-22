import { describe, expect, it } from 'vitest';
import type { Match } from '#lib/types.ts';
import { matchStakes } from './stakes.ts';
import { fakeAnalysis, fixtureBundle, unplay } from './test-fixtures.ts';

const full = fixtureBundle('USMTBUQ-final');
const late = (match: Match) => match.level === 'qual' && match.number >= 30;
const bundle = unplay(full, late);
const analysis = fakeAnalysis(full);
const q30 = bundle.matches.find((match) => match.key === 'q30')!;

describe('matchStakes', () => {
	it('gives every team better captain odds with a win than with a loss', () => {
		const stakes = matchStakes({
			match: q30,
			matches: bundle.matches,
			rankings: full.rankings,
			analysis
		})!;
		expect(stakes.spots).toBe(6);
		expect(stakes.teams.map((row) => row.team)).toEqual(
			[...q30.red, ...q30.blue].map((entry) => entry.team)
		);
		for (const row of stakes.teams) {
			expect(row.win).toBeGreaterThanOrEqual(row.loss);
			expect(row.now).toBeGreaterThanOrEqual(row.loss - 0.02);
			expect(row.now).toBeLessThanOrEqual(row.win + 0.02);
		}
		expect(stakes.teams.some((row) => row.win - row.loss > 0.05)).toBe(true);
	});

	it('is the same on every run so server and browser agree', () => {
		const input = { match: q30, matches: bundle.matches, rankings: full.rankings, analysis };
		expect(matchStakes(input)).toEqual(matchStakes(input));
	});

	it('skips played matches and events without projections', () => {
		const played = full.matches.find((match) => match.key === 'q30')!;
		expect(
			matchStakes({ match: played, matches: full.matches, rankings: full.rankings, analysis })
		).toBeNull();
		expect(
			matchStakes({
				match: q30,
				matches: bundle.matches,
				rankings: full.rankings,
				analysis: { ...analysis, projections: null }
			})
		).toBeNull();
	});
});
