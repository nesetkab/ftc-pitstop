import { describe, expect, it, vi } from 'vitest';
import { analyzeEvent } from '#lib/analysis/analyze.ts';
import { toModelEvent } from '#lib/analysis/convert.ts';
import { baseContext, buildSeason } from '#lib/analysis/season.ts';
import { previousFrom, rateSeason } from '#lib/model/opr.ts';
import previous2025 from '#lib/model/previous-2025.json';
import { createAnalysis } from '#lib/server/analysis.ts';
import { createCache } from '#lib/server/cache.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { SeasonMatch } from '#lib/types.ts';
import { bundleFor, fixtureLoaders, seasonMatchesOf } from './helpers.ts';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const previous = previousFrom(previous2025.teams);
const gilbert = await bundleFor('USAZGIQ');
const earlier = seasonMatchesOf(gilbert, 'USAZXXQ', '2026-11-07');

function setup(
	options: { season?: () => Promise<SeasonMatch[]>; budgetMs?: number; clock?: () => number } = {}
) {
	const season = vi.fn(async () => ({
		matches: await (options.season ?? (async () => earlier))(),
		fetchedAt: NOW,
		stale: false,
		missing: []
	}));
	const background = vi.fn();
	const analysis = createAnalysis({
		loaders: { loadEventBundle: fixtureLoaders().loadEventBundle, loadSeasonMatches: season },
		cache: createCache({ onError: () => {}, now: options.clock ?? (() => NOW) }),
		previous,
		now: options.clock ?? (() => NOW),
		budgetMs: options.budgetMs,
		background
	});
	return { ...analysis, season, background };
}

describe('season model', () => {
	it('reads season matches the same way as event bundles', () => {
		const fromSeason = buildSeason(earlier, { previous, now: NOW }).run.events.get('USAZXXQ')!;
		const fromBundle = rateSeason([toModelEvent(gilbert)], { previous }).events.get('USAZGIQ')!;
		for (const team of fromBundle.rater.teams) {
			expect(fromSeason.rater.value(team)).toBeCloseTo(fromBundle.rater.value(team), 9);
			expect(fromSeason.rater.value(team, 'hive')).toBeCloseTo(
				fromBundle.rater.value(team, 'hive'),
				9
			);
		}
	});
});

describe('createAnalysis', () => {
	it('ranks the season and caches the ratings', async () => {
		const data = setup();
		const ratings = (await data.loadSeasonRatings())!;
		expect(ratings.teams).toHaveLength(27);
		expect(ratings.teams.map((t) => t.rank)).toEqual(ratings.teams.map((_, i) => i + 1));
		expect(ratings.teams[0].percentile).toBe(1);
		expect(ratings.teams.at(-1)!.percentile).toBe(0);
		expect(ratings.teams.every((t) => t.region === 'USAZ' && t.events === 1 && t.matches > 0)).toBe(
			true
		);
		await data.loadSeasonRatings();
		expect(data.season).toHaveBeenCalledTimes(1);
	});

	it('analyzes an event with priors from earlier events only', async () => {
		const data = setup();
		const { analysis, cacheControl } = await data.loadEventAnalysisEntry('usazgiq');
		expect(cacheControl).toBe('public, s-maxage=86400');
		const teams = analysis.ratings.map((r) => r.team);
		const before = await data.priorsForTeams(teams, Date.parse('2026-11-14T00:00:00Z'));
		expect(Object.keys(before.states)).toHaveLength(27);
		const sameDay = await data.priorsForTeams(teams, Date.parse('2026-11-07T15:00:00Z'));
		expect(Object.keys(sameDay.states)).toHaveLength(0);
		const cold = analyzeEvent(gilbert, baseContext(teams, previous), { now: NOW });
		expect(analysis.ratings[0].prior).not.toBeCloseTo(
			cold.ratings.find((r) => r.team === analysis.ratings[0].team)!.prior,
			1
		);
		expect((await data.loadEventAnalysis('USAZGIQ'))!.generatedAt).toBe(analysis.generatedAt);
		expect(await data.loadEventAnalysis('NOPE123')).toBeNull();
	});

	it('answers right away with last season priors while the season loads', async () => {
		const started = performance.now();
		const data = setup({
			season: () => new Promise(() => {}),
			budgetMs: 200,
			clock: () => NOW + Math.round(performance.now() - started)
		});
		const { analysis, cacheControl } = await data.loadEventAnalysisEntry('USAZGIQ');
		expect(cacheControl).toBe(CACHE_CONTROL.live);
		expect(data.background).toHaveBeenCalledTimes(1);
		const start = performance.now();
		await data.loadEventAnalysisEntry('USAZGIQ');
		expect(performance.now() - start).toBeLessThan(150);
		expect(data.background).toHaveBeenCalledTimes(2);
		const teams = analysis.ratings.map((r) => r.team);
		const cold = analyzeEvent(gilbert, baseContext(teams, previous), { now: NOW });
		expect(analysis.ratings).toEqual(cold.ratings);
	});

	it('keeps the last complete season when a refresh comes back with weeks missing', async () => {
		let time = NOW;
		let missing: string[] = [];
		const season = vi.fn(async () => ({
			matches: missing.length > 0 ? earlier.slice(0, 8) : earlier,
			fetchedAt: time,
			stale: missing.length > 0,
			missing
		}));
		const analysis = createAnalysis({
			loaders: { loadEventBundle: fixtureLoaders().loadEventBundle, loadSeasonMatches: season },
			cache: createCache({ onError: () => {}, now: () => time }),
			previous,
			now: () => time,
			background: vi.fn()
		});
		const full = await analysis.loadSeasonModel();
		expect(full.complete).toBe(true);
		missing = ['2026-11-03'];
		time += 61 * 60_000;
		await analysis.loadSeasonModel();
		await vi.waitFor(() => expect(season).toHaveBeenCalledTimes(2));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(await analysis.loadSeasonModel()).toBe(full);
		time += 30_000;
		await analysis.loadSeasonModel();
		expect(season).toHaveBeenCalledTimes(2);
		missing = [];
		time += 2 * 60_000;
		await analysis.loadSeasonModel();
		await vi.waitFor(() => expect(season).toHaveBeenCalledTimes(3));
		await new Promise((resolve) => setTimeout(resolve, 0));
		const back = await analysis.loadSeasonModel();
		expect(back).not.toBe(full);
		expect(back.complete).toBe(true);
	});

	it('returns a team rating history', async () => {
		const data = setup();
		const history = (await data.loadTeamRatingHistory('26670'))!;
		expect(history.events).toMatchObject([{ code: 'USAZXXQ', start: '2026-11-07' }]);
		expect(history.points).toHaveLength(history.events[0].matches);
		expect(history.points.at(-1)!.opr).toBeTypeOf('number');
		expect(await data.loadTeamRatingHistory(99998)).toBeNull();
		await expect(data.loadTeamRatingHistory(999998)).rejects.toMatchObject({ status: 404 });
		await expect(data.loadTeamRatingHistory('abc')).rejects.toMatchObject({ status: 404 });
	});
});
