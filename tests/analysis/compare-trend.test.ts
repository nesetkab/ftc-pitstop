import { describe, expect, it } from 'vitest';
import { buildSeason } from '#lib/analysis/season.ts';
import { seasonTrend } from '#lib/components/compare/trend.ts';
import { teamEvent, teamSeason } from '#lib/components/team/fixtures.ts';
import type { PriorRel } from '#lib/model/opr.ts';
import { bundleFor, seasonMatchesOf } from './helpers.ts';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const bundle = await bundleFor('USAZGIQ');
const first = seasonMatchesOf(bundle, 'USAZXXQ', '2026-11-07');
const second = seasonMatchesOf(bundle, 'USAZYYQ', '2026-11-14');
const model = buildSeason([...first, ...second], {
	previous: new Map<number, PriorRel>(),
	now: NOW
});
const [a, b] = first[0].red.teams;
const outsider = 999_999;

describe('seasonTrend', () => {
	const seasons = [
		teamSeason(a, 'A', [teamEvent({ code: 'USAZXXQ', name: 'Arizona One' })]),
		teamSeason(b, 'B'),
		teamSeason(outsider, 'C')
	];
	const lines = seasonTrend(model, seasons);

	it('gives each team one point per event in date order', () => {
		expect(lines.map((line) => line.number)).toEqual([a, b, outsider]);
		expect(lines[0].points.map((point) => point.code)).toEqual(['USAZXXQ', 'USAZYYQ']);
		expect(lines[0].points.map((point) => point.start)).toEqual(['2026-11-07', '2026-11-14']);
	});

	it('uses the aOPR after each event and the event name when known', () => {
		const rater = model.run.events.get('USAZYYQ')!.rater;
		expect(lines[0].points[1].opr).toBeCloseTo(rater.value(a), 2);
		expect(lines[0].points[0].event).toBe('Arizona One');
		expect(lines[0].points[1].event).toBe('USAZYYQ');
	});

	it('leaves a team with no matches empty', () => {
		expect(lines[2].points).toEqual([]);
	});
});
