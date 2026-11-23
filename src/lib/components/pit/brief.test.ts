import { describe, expect, it } from 'vitest';
import type { MatchForecast, TeamRating } from '#lib/analysis/types.ts';
import { replayBundle, replayStart } from '#lib/game/replay.ts';
import { matchBrief, stakeLine, stakeText } from './brief.ts';
import { fixtureBundle } from './fixtures.ts';
import { pitView, type NextMatch } from './view.ts';

const TEAM = 14624;
const full = fixtureBundle('USAZGIQ');
const base = pitView({
	bundle: replayBundle(full, replayStart('Q22', full)!),
	analysis: null,
	queue: null,
	team: TEAM
}).next!;

function rating(team: number, opr: number, auto: number, hive: number, tips: number): TeamRating {
	return {
		team,
		opr,
		parts: { auto, hive, tips, flower: 0, garden: 0, park: 0 },
		matches: 5,
		rank: 1,
		prior: opr,
		history: []
	};
}

const side = (score: number, win: number) => ({
	score,
	sd: 10,
	win,
	rp: { win, tie: 0, swarm: 0.4, pollinator1: 0.3, pollinator2: 0.05, expected: 2.1 }
});

const forecast: MatchForecast = {
	key: 'q26',
	red: side(80, 0.62),
	blue: side(70, 0.36),
	tie: 0.02,
	played: false,
	correct: null
};

const next: NextMatch = { ...base, forecast };

describe('matchBrief', () => {
	it('puts us first and compares the alliances part by part', () => {
		const brief = matchBrief(next, [
			rating(TEAM, 40, 12, 20, 1.5),
			rating(25620, 30, 6, 18, 0.4),
			rating(32043, 25, 4, 15, 0.2),
			rating(22258, 20, 3, 10, 2.5)
		]);
		expect(brief.ours.color).toBe('red');
		expect(brief.ours.teams.map((team) => team.number)).toEqual([TEAM, 25620]);
		expect(brief.theirs.teams.map((team) => team.number)).toEqual([32043, 22258]);
		expect(brief.ours.totals).toEqual({ opr: 70, auto: 18, hive: 38, tips: 1.9 });
		expect(brief.ours.win).toBe(0.62);
		expect(brief.ours.rp?.expected).toBe(2.1);
		expect(brief.ours.teams[0].best).toEqual(['opr', 'auto', 'hive']);
		expect(brief.theirs.teams[1].best).toEqual(['tips']);
		expect(brief.notes).toEqual([
			"We're stronger at the hive, by about 13 points.",
			"We're stronger overall, by about 25 points.",
			'We have the best auto and hive on the field.',
			'22258 has the best tips on the field.'
		]);
	});

	it('calls an even match even and leaves unrated teams blank', () => {
		const even = matchBrief(next, [
			rating(TEAM, 30, 6, 10, 1),
			rating(25620, 30, 6, 10, 1),
			rating(32043, 30, 6, 10, 1),
			rating(22258, 30, 6, 10, 1)
		]);
		expect(even.notes).toEqual(['The alliances are evenly matched on paper.']);
		const unrated = matchBrief({ ...next, forecast: null }, [rating(TEAM, 30, 6, 10, 1)]);
		expect(unrated.ours.totals).toBeNull();
		expect(unrated.theirs.teams.every((team) => team.values === null)).toBe(true);
		expect(unrated.ours.win).toBeNull();
		expect(unrated.notes).toEqual([]);
	});
});

describe('stakeLine', () => {
	it('picks our row and says it plainly', () => {
		const stakes = {
			spots: 4,
			teams: [
				{ team: 1, color: 'red' as const, now: 0.1, win: 0.2, loss: 0.05 },
				{ team: TEAM, color: 'red' as const, now: 0.4, win: 0.55, loss: 0.25 }
			]
		};
		const line = stakeLine(stakes, TEAM)!;
		expect(line).toEqual({ spots: 4, now: 0.4, win: 0.55, loss: 0.25 });
		expect(stakeText(line)).toBe(
			'Chance to finish top 4: 40% now, 55% with a win, 25% with a loss.'
		);
		expect(stakeLine(stakes, 999)).toBeNull();
		expect(stakeLine(null, TEAM)).toBeNull();
	});
});
