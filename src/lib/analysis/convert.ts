import { POINTS } from '#lib/game/biobuzz.ts';
import type { AllianceDetail, ModelEvent, ModelMatch } from '#lib/model/types.ts';
import type {
	AllianceScore,
	EventBundle,
	Match,
	MatchTeam,
	ScoreBreakdown,
	SeasonMatch,
	SeasonMatchAlliance
} from '#lib/types.ts';

export function playingTeams(teams: MatchTeam[]): MatchTeam[] {
	const seated = teams.filter((team) => team.station === 1 || team.station === 2);
	const pool = seated.length > 2 ? seated.filter((team) => team.onField) : seated;
	return [...(pool.length ? pool : teams.slice(0, 2))].sort((a, b) => a.station - b.station);
}

function robotPoints(breakdown: ScoreBreakdown, station: number): number {
	const k = station === 2 ? 1 : 0;
	return (
		POINTS.leave * Number(breakdown.auto.leave[k]) +
		POINTS.park * (Number(breakdown.auto.park[k]) + Number(breakdown.teleop.park[k]))
	);
}

export function allianceDetail(
	score: AllianceScore,
	opponent: AllianceScore,
	teams: MatchTeam[]
): AllianceDetail {
	const breakdown = score.breakdown;
	const base = { autoPoints: score.auto, teleopPoints: score.teleop, fouls: opponent.foulPoints };
	if (!breakdown) return base;
	const points = breakdown.points;
	return {
		...base,
		hivePoints: points.teleopHive,
		flowerPoints: points.teleopFlower,
		gardenPoints: points.teleopGarden,
		parkPoints: points.teleopPark,
		leavePoints: points.autoLeave + points.autoPark,
		tips: breakdown.auto.tips + breakdown.teleop.tips,
		robotSwarm: teams.map((team) => robotPoints(breakdown, team.station))
	};
}

export function toModelMatch(eventCode: string, match: Match): ModelMatch {
	const red = playingTeams(match.red);
	const blue = playingTeams(match.blue);
	const all = [...red, ...blue];
	const result = match.result;
	const flagged = (flag: 'surrogate' | 'noShow' | 'dq') =>
		all.filter((team) => team[flag]).map((team) => team.team);
	return {
		key: match.key,
		eventCode,
		level: match.level,
		series: match.series,
		number: match.number,
		time: match.actualTime ?? match.scheduledTime ?? match.postedTime ?? 0,
		scheduledTime: match.scheduledTime,
		actualTime: match.actualTime,
		red: red.map((team) => team.team),
		blue: blue.map((team) => team.team),
		redScore: result ? result.red.total : null,
		blueScore: result ? result.blue.total : null,
		redNp: result ? result.red.preFoulTotal : null,
		blueNp: result ? result.blue.preFoulTotal : null,
		redDetail: result ? allianceDetail(result.red, result.blue, red) : undefined,
		blueDetail: result ? allianceDetail(result.blue, result.red, blue) : undefined,
		surrogates: flagged('surrogate'),
		noShows: flagged('noShow'),
		dqs: flagged('dq')
	};
}

export function toModelEvent(bundle: Pick<EventBundle, 'event' | 'matches'>): ModelEvent {
	return {
		code: bundle.event.code,
		start: bundle.event.start,
		end: bundle.event.end,
		matches: bundle.matches
			.filter((match) => match.red.length > 0 && match.blue.length > 0)
			.map((match) => toModelMatch(bundle.event.code, match))
	};
}

function seasonDetail(own: SeasonMatchAlliance, other: SeasonMatchAlliance): AllianceDetail {
	return {
		autoPoints: own.auto,
		teleopPoints: own.teleop,
		hivePoints: own.hive,
		flowerPoints: own.flower,
		gardenPoints: own.garden,
		parkPoints: own.park,
		leavePoints: own.leavePark - own.park,
		tips: own.tips,
		fouls: other.foulPoints,
		robotSwarm: own.robots
	};
}

export function seasonModelMatch(match: SeasonMatch): ModelMatch {
	const { red, blue } = match;
	return {
		key: match.key,
		eventCode: match.eventCode,
		level: match.level,
		series: match.series,
		number: match.number,
		time: match.time ?? Date.parse(`${match.date}T00:00:00Z`),
		actualTime: match.time,
		red: red.teams,
		blue: blue.teams,
		redScore: red.total,
		blueScore: blue.total,
		redNp: red.preFoulTotal,
		blueNp: blue.preFoulTotal,
		redDetail: seasonDetail(red, blue),
		blueDetail: seasonDetail(blue, red),
		surrogates: [...red.surrogates, ...blue.surrogates],
		noShows: [...red.noShows, ...blue.noShows],
		dqs: [...red.dqs, ...blue.dqs]
	};
}

export function seasonEvents(matches: SeasonMatch[]): ModelEvent[] {
	const events = new Map<string, ModelEvent>();
	for (const match of matches) {
		if (!match.red.teams.length || !match.blue.teams.length) continue;
		let event = events.get(match.eventCode);
		if (!event) {
			event = { code: match.eventCode, start: match.date, end: match.end, matches: [] };
			events.set(match.eventCode, event);
		}
		event.matches.push(seasonModelMatch(match));
	}
	return [...events.values()];
}
