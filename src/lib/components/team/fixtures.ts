import type {
	EventSummary,
	Match,
	MatchTeam,
	Ranking,
	TeamSeason,
	TeamSeasonEvent
} from '#lib/types.ts';
import type { FollowedBundle } from './follow-status.ts';

export function eventSummary(overrides: Partial<EventSummary> = {}): EventSummary {
	return {
		code: 'USAZGIQ',
		name: 'Roadrunner - Gilbert Qualifier',
		type: 'Qualifier',
		typeName: 'Qualifier',
		region: 'USAZ',
		league: null,
		venue: 'Gilbert Christian High School',
		city: 'Gilbert',
		state: 'AZ',
		country: 'USA',
		timezone: 'America/Phoenix',
		start: '2026-11-14',
		end: '2026-11-14',
		hasMatches: true,
		...overrides
	};
}

export function teamEvent(overrides: Partial<EventSummary> = {}): TeamSeasonEvent {
	return { event: eventSummary(overrides), stats: null, awards: [] };
}

export function teamSeason(
	number: number,
	name: string,
	events: TeamSeasonEvent[] = []
): TeamSeason {
	return {
		team: {
			number,
			name,
			fullName: null,
			school: null,
			city: 'Phoenix',
			state: 'AZ',
			country: 'USA',
			rookieYear: 2024
		},
		events,
		quickStats: null,
		previousQuickStats: null,
		fetchedAt: Date.parse('2026-11-14T20:00:00Z'),
		stale: false
	};
}

function side(teams: number[]): MatchTeam[] {
	return teams.map((team, index) => ({
		team,
		station: index + 1,
		surrogate: false,
		noShow: false,
		dq: false,
		onField: true
	}));
}

export function match(
	number: number,
	red: number[],
	blue: number[],
	scheduled: string,
	played: boolean
): Match {
	const score = { total: 0, preFoulTotal: 0, auto: 0, teleop: 0, foulPoints: 0, breakdown: null };
	return {
		key: `q${number}`,
		level: 'qual',
		series: 0,
		number,
		label: `Q${number}`,
		description: `Qualification ${number}`,
		scheduledTime: Date.parse(scheduled),
		actualTime: null,
		postedTime: null,
		red: side(red),
		blue: side(blue),
		result: played ? { red: score, blue: score, winner: 'red' } : null
	};
}

export function ranking(rank: number, team: number, wins: number, losses: number): Ranking {
	return {
		rank,
		team,
		rs: 0,
		tbp: 0,
		avgTips: 0,
		avgAuto: 0,
		wins,
		losses,
		ties: 0,
		played: wins + losses,
		dq: 0
	};
}

export function followedBundle(matches: Match[], rankings: Ranking[]): FollowedBundle {
	return { matches, rankings, event: { timezone: 'America/Phoenix' } };
}
