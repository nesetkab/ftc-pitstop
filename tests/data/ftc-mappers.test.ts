import { describe, expect, it } from 'vitest';
import { breakdownParts } from '#lib/game/biobuzz.ts';
import {
	ftcAdvancementResponse,
	ftcAlliancesResponse,
	ftcAwardsResponse,
	ftcEventsResponse,
	ftcMatchesResponse,
	ftcRankingsResponse,
	ftcScheduleResponse,
	ftcScoresResponse,
	ftcTeamsResponse
} from '#lib/server/ftc/schemas.ts';
import {
	mapAdvancement,
	mapAlliances,
	mapAwards,
	mapEvent,
	mapMatches,
	mapRankings,
	mapTeams,
	matchKey,
	schoolFromFullName
} from '#lib/server/ftc/mappers.ts';
import { isValidTimeZone } from '#lib/server/time.ts';
import type { Match } from '#lib/types.ts';
import { FIXTURE_EVENTS, fixture } from './helpers.ts';

function load(code: string) {
	const parse = <T>(schema: { parse: (value: unknown) => T }, name: string) =>
		schema.parse(fixture(code, name));
	const event = parse(ftcEventsResponse, 'event');
	const timezone = mapEvent(event.events![0]).timezone;
	return {
		event,
		teams: parse(ftcTeamsResponse, 'teams'),
		rankings: parse(ftcRankingsResponse, 'rankings'),
		qualSchedule: parse(ftcScheduleResponse, 'schedule-qual'),
		playoffSchedule: parse(ftcScheduleResponse, 'schedule-playoff'),
		qualMatches: parse(ftcMatchesResponse, 'matches-qual'),
		playoffMatches: parse(ftcMatchesResponse, 'matches-playoff'),
		qualScores: parse(ftcScoresResponse, 'scores-qual'),
		playoffScores: parse(ftcScoresResponse, 'scores-playoff'),
		alliances: parse(ftcAlliancesResponse, 'alliances'),
		awards: parse(ftcAwardsResponse, 'awards'),
		advancement: parse(ftcAdvancementResponse, 'advancement'),
		timezone
	};
}

function matchesFor(code: string): Match[] {
	const data = load(code);
	return mapMatches({
		timezone: data.timezone,
		qualSchedule: data.qualSchedule,
		playoffSchedule: data.playoffSchedule,
		qualScores: data.qualScores,
		playoffScores: data.playoffScores
	});
}

const find = (matches: Match[], key: string) => {
	const match = matches.find((candidate) => candidate.key === key);
	if (!match) throw new Error(`missing ${key}`);
	return match;
};

describe.each(FIXTURE_EVENTS)('FTC mappers on %s', (code) => {
	const data = load(code);

	it('maps the event', () => {
		const event = mapEvent(data.event.events![0]);
		expect(event.code).toBe(code);
		expect(event.name.length).toBeGreaterThan(0);
		expect(isValidTimeZone(event.timezone)).toBe(true);
		expect(event.start <= event.end).toBe(true);
		expect(event.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(event.typeName.length).toBeGreaterThan(0);
		expect(Array.isArray(event.webcasts)).toBe(true);
	});

	it('maps teams', () => {
		const teams = mapTeams([data.teams]);
		expect(teams.length).toBe(data.teams.teamCountTotal);
		expect(teams.map((team) => team.number)).toEqual(
			[...teams.map((team) => team.number)].sort((a, b) => a - b)
		);
		for (const team of teams) {
			expect(team.name.length).toBeGreaterThan(0);
			expect(team.name).toBe(team.name.trim());
		}
	});

	it('maps rankings', () => {
		const rankings = mapRankings(data.rankings);
		expect(rankings.map((ranking) => ranking.rank)).toEqual(rankings.map((_, i) => i + 1));
		for (const ranking of rankings) {
			expect(ranking.wins + ranking.losses + ranking.ties).toBe(ranking.played);
			expect(ranking.rs).toBeGreaterThanOrEqual(0);
			expect(ranking.avgTips).toBeGreaterThanOrEqual(0);
		}
	});

	it('maps alliances, awards and advancement', () => {
		const alliances = mapAlliances(data.alliances);
		expect(alliances.map((alliance) => alliance.seed)).toEqual(alliances.map((_, i) => i + 1));
		expect(new Set(alliances.map((alliance) => alliance.captain)).size).toBe(alliances.length);
		for (const alliance of alliances) expect(alliance.picks.length).toBeGreaterThan(0);
		for (const award of mapAwards(data.awards)) {
			expect(award.name.length).toBeGreaterThan(0);
			expect(award.placement).toBeGreaterThan(0);
		}
		const advancement = mapAdvancement(data.advancement);
		expect(advancement.teams.map((slot) => slot.slot)).toEqual(
			advancement.teams.map((_, i) => i + 1)
		);
	});

	it('merges schedule and score details into matches', () => {
		const matches = matchesFor(code);
		const schedule = [
			...(data.qualSchedule.schedule ?? []),
			...(data.playoffSchedule.schedule ?? [])
		];
		expect(matches.length).toBe(schedule.length);
		expect(new Set(matches.map((match) => match.key)).size).toBe(matches.length);
		for (const match of matches) {
			expect(match.key).toMatch(/^(q\d+|p\d+(-\d+)?)$/);
			expect(match.label).toMatch(/^(Q\d+|M\d+(-\d+)?|F\d+)$/);
			expect(match.description).not.toMatch(/\s{2}/);
			for (const side of [match.red, match.blue]) {
				expect(side.map((team) => team.station)).toEqual(
					[...side.map((team) => team.station)].sort()
				);
			}
			if (match.actualTime && match.postedTime)
				expect(match.postedTime).toBeGreaterThan(match.actualTime);
			if (!match.result) continue;
			const raw = schedule.find(
				(entry) => entry.series === match.series && entry.matchNumber === match.number
			)!;
			expect(match.result.red.total).toBe(raw.scoreRedFinal);
			expect(match.result.blue.total).toBe(raw.scoreBlueFinal);
			expect(match.result.red.breakdown).not.toBeNull();
			expect(match.result.red.foulPoints).toBe(raw.scoreBlueFoul);
			expect(match.result.blue.foulPoints).toBe(raw.scoreRedFoul);
			for (const side of [match.result.red, match.result.blue]) {
				const parts = breakdownParts(side);
				expect(Object.values(parts).reduce((sum, value) => sum + value, 0)).toBe(side.total);
				expect(side.preFoulTotal).toBe(side.auto + side.teleop);
			}
			if (raw.redWins) expect(match.result.winner).toBe('red');
			if (raw.blueWins) expect(match.result.winner).toBe('blue');
		}
	});

	it('agrees with the matches endpoint', () => {
		const matches = matchesFor(code);
		const results = [...(data.qualMatches.matches ?? []), ...(data.playoffMatches.matches ?? [])];
		expect(results.length).toBe(matches.filter((match) => match.result).length);
		for (const raw of results) {
			const match = matches.find(
				(candidate) =>
					candidate.series === raw.series &&
					candidate.number === raw.matchNumber &&
					candidate.level === (raw.tournamentLevel?.startsWith('QUAL') ? 'qual' : 'playoff')
			);
			expect(match?.result?.red.total).toBe(raw.scoreRedFinal);
			expect(match?.result?.blue.total).toBe(raw.scoreBlueFinal);
		}
	});
});

describe('FTC mapper details', () => {
	it('converts venue local times with the event time zone', () => {
		const q1 = find(matchesFor('USAZGIQ'), 'q1');
		expect(new Date(q1.scheduledTime!).toISOString()).toBe('2026-11-14T17:30:00.000Z');
		expect(new Date(q1.actualTime!).toISOString()).toBe('2026-11-14T17:33:17.955Z');
		const tashkent = find(matchesFor('UZTAQ1'), 'q1');
		expect(new Date(tashkent.scheduledTime!).toISOString()).toBe('2026-11-14T11:40:00.000Z');
	});

	it('keeps surrogate, no-show and off-field flags', () => {
		const az = matchesFor('USAZGIQ');
		expect(find(az, 'q15').red.find((team) => team.team === 15135)?.surrogate).toBe(true);
		expect(find(az, 'q1').red.find((team) => team.team === 32043)).toMatchObject({
			onField: false,
			noShow: false
		});
		const uz = find(matchesFor('UZTAQ1'), 'q1').blue.find((team) => team.team === 35580);
		expect(uz).toMatchObject({ noShow: true, dq: true, onField: false, station: 2 });
		const fl = find(matchesFor('USFLORM1'), 'q21').red.find((team) => team.team === 39085);
		expect(fl).toMatchObject({ noShow: true, dq: true });
	});

	it('keys playoff matches by series and finals-only brackets by game', () => {
		const az = matchesFor('USAZGIQ').filter((match) => match.level === 'playoff');
		expect(az.map((match) => match.key)).toEqual([
			'p1',
			'p2',
			'p3',
			'p4',
			'p5',
			'p6',
			'p7',
			'p8',
			'p9',
			'p10'
		]);
		expect(az.map((match) => match.label).at(-1)).toBe('M10');
		const mi = find(matchesFor('USMISOQ'), 'p11');
		expect(mi.label).toBe('M11');
		expect(mi.description).toBe('Final Bracket Round 7 Match 11');
		expect(mi.result?.winner).toBe('blue');
		const al = matchesFor('USALATQ').filter((match) => match.level === 'playoff');
		expect(al.map((match) => [match.key, match.label, match.series, match.number])).toEqual([
			['p1', 'F1', 1, 1],
			['p2', 'F2', 1, 2]
		]);
		expect(matchKey('playoff', 5, 2, 'Lower Bracket  Round 3 Match 5')).toEqual({
			key: 'p5-2',
			label: 'M5-2'
		});
	});

	it('maps BIOBUZZ score details', () => {
		const q1 = find(matchesFor('USAZGIQ'), 'q1');
		expect(q1.result?.blue.breakdown).toEqual({
			auto: { leave: [true, true], park: [true, false], tips: 0 },
			teleop: {
				tips: 3,
				cellBalls: 0,
				flowers: { red: ['pollen', 'pollen'], blue: [], scoring: [], audience: [] },
				gardenBalls: 2,
				park: [true, true]
			},
			points: {
				autoLeave: 6,
				autoPark: 5,
				autoHive: 0,
				auto: 11,
				teleopHive: 60,
				teleopFlower: 0,
				teleopGarden: 2,
				teleopPark: 10,
				teleop: 72
			},
			minorFouls: 0,
			majorFouls: 0,
			foulPointsCommitted: 0,
			rp: { swarm: true, pollinator1: false, pollinator2: false }
		});
		const flower = find(matchesFor('USMISOQ'), 'q37').result!.blue.breakdown!;
		expect(flower.teleop.flowers.scoring).toEqual([
			'pollen',
			'pollen',
			'pollen',
			'pollen',
			'pollen',
			'blue'
		]);
		expect(flower.points.teleopFlower).toBe(17);
	});

	it('handles an event with nothing scheduled yet', () => {
		const data = load('USMTBUQ');
		expect(matchesFor('USMTBUQ')).toEqual([]);
		expect(mapRankings(data.rankings)).toEqual([]);
		expect(mapAlliances(data.alliances)).toEqual([]);
		expect(mapAwards(data.awards)).toEqual([]);
		expect(mapAdvancement(data.advancement)).toEqual({
			advancesTo: 'USMTCMP',
			slots: 0,
			fcmpReserved: 0,
			teams: []
		});
		expect(mapEvent(data.event.events![0])).toMatchObject({
			published: false,
			type: 'Qualifier',
			timezone: 'America/Denver'
		});
	});

	it('maps event types and team names', () => {
		expect(mapEvent(load('USFLORM1').event.events![0])).toMatchObject({
			type: 'LeagueMeet',
			league: 'OR'
		});
		expect(mapEvent(load('KZASN2').event.events![0])).toMatchObject({
			type: 'NonAdvancement',
			typeName: 'Non-Advancement'
		});
		expect(schoolFromFullName('Resolution Copper&Globe High School')).toBe('Globe High School');
		expect(schoolFromFullName('Family/Community')).toBeNull();
		const team = mapTeams([load('USAZGIQ').teams]).find((entry) => entry.number === 2844);
		expect(team).toMatchObject({
			name: 'Valley X Robotics',
			school: 'Valley Christian High School',
			rookieYear: 2008
		});
	});

	it('falls back to schedule totals when score details are missing', () => {
		const az = load('USAZGIQ');
		const q1 = find(mapMatches({ timezone: az.timezone, qualSchedule: az.qualSchedule }), 'q1');
		expect(q1.result?.red).toEqual({
			total: 89,
			preFoulTotal: 89,
			auto: 28,
			teleop: 61,
			foulPoints: 0,
			breakdown: null
		});
		let fouled = 0;
		for (const code of FIXTURE_EVENTS) {
			const data = load(code);
			const bare = mapMatches({
				timezone: data.timezone,
				qualSchedule: data.qualSchedule,
				playoffSchedule: data.playoffSchedule
			});
			const detailed = matchesFor(code);
			for (const match of bare) {
				if (!match.result) continue;
				const full = find(detailed, match.key).result!;
				for (const color of ['red', 'blue'] as const) {
					const { breakdown, ...totals } = full[color];
					expect(breakdown).not.toBeNull();
					expect(match.result[color]).toEqual({ ...totals, breakdown: null });
					if (totals.foulPoints > 0) fouled++;
				}
				expect(match.result.winner).toBe(full.winner);
			}
		}
		expect(fouled).toBeGreaterThan(0);
	});
});
