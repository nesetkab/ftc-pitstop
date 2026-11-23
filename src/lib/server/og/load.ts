import type { SeasonRatings } from '#lib/analysis/types.ts';
import { eventStatus } from '#lib/components/event/dates.ts';
import { titleOf } from '#lib/components/event/matches.ts';
import type { RankedRecord } from '#lib/components/records/records.ts';
import { colorName, type Sides, type Simulation } from '#lib/components/simulate/simulate.ts';
import { placeName } from '#lib/format/places.ts';
import { dateRange, fixed, integer, ordinal, record, shortDate, time } from '#lib/format/index.ts';
import { pct } from '#lib/format/pct.ts';
import { WINNER_AWARD_ID } from '#lib/game/phase.ts';
import { SEASON_NAME } from '#lib/seo.ts';
import { DataError } from '#lib/server/errors.ts';
import {
	compareCard,
	eventCard,
	listCard,
	matchCard,
	pageCard,
	siteCard,
	teamCard,
	type AllianceLine,
	type CompareColumn,
	type OgNode,
	type PageCard,
	type Stat
} from '#lib/server/og/cards.ts';
import type { EventBundle, Match, TeamSeason } from '#lib/types.ts';

export interface Names {
	teams: Record<number, string>;
	events: Record<string, string>;
}

export interface OgDeps {
	loadTeamSeason(number: number): Promise<TeamSeason | null>;
	loadSeasonRatings(): Promise<SeasonRatings | null>;
	loadEventBundle(code: string): Promise<EventBundle>;
	loadTopRecords(count: number): Promise<RankedRecord[] | null>;
	loadNames(teams: number[], events: string[]): Promise<Names>;
	loadSimulation(sides: Sides): Promise<Simulation | null>;
}

export interface OgCard {
	node: OgNode;
	maxAge: number;
}

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown } | null;

const TEAM_PATH = /^teams\/([1-9]\d{0,4})\.png$/;
const EVENT_PATH = /^events\/([A-Z0-9]{2,24})\.png$/;
const MATCH_PATH = /^events\/([A-Z0-9]{2,24})\/matches\/([qp]\d{1,3}(?:-\d{1,3})?)\.png$/;
const COMPARE_PATH = /^compare\/([1-9]\d{0,4}(?:-[1-9]\d{0,4}){1,3})\.png$/;
const SIMULATE_PATH =
	/^simulate\/([1-9]\d{0,4})-([1-9]\d{0,4})-vs-([1-9]\d{0,4})-([1-9]\d{0,4})\.png$/;
const LIVE_SECONDS = 120;
const published = import.meta.glob('/src/lib/model/accuracy.json', {
	eager: true,
	import: 'default'
});
const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86_400;

const PAGES: Record<string, PageCard> = {
	'events.png': {
		kicker: SEASON_NAME,
		title: 'Every FTC event this season',
		subtitle: 'Live rankings, schedules with predictions, results and awards.'
	},
	'advancement.png': {
		kicker: SEASON_NAME,
		title: 'Who has advanced to each FTC championship',
		subtitle: 'Teams advanced so far, how they earned it, and the qualifiers still to play.'
	},
	'accuracy.png': {
		kicker: 'Prediction accuracy',
		title: 'How PitStop’s match predictions did on past seasons',
		subtitle: 'Winner accuracy, Brier score, score error and calibration.'
	},
	'compare.png': {
		kicker: 'Compare',
		title: 'Compare FTC teams side by side',
		subtitle: 'OPR by part, records, shared events and head-to-head results.'
	},
	'simulate.png': {
		kicker: 'Match simulator',
		title: 'Pick any four FTC teams and see the predicted match',
		subtitle: 'Predicted score, win chance and ranking point chances for each alliance.'
	},
	'workspace.png': {
		kicker: 'Team tools',
		title: 'Pick list, strategy board and checklists for your team',
		subtitle: 'Shared with your team by a join code.'
	}
};

type Pooled = Record<string, Record<string, { n: number; brier: number; accuracy: number }>>;

export function accuracyStats(report: unknown): Stat[] {
	const data = report as { chosen?: { id?: string }; pooled?: Pooled } | null;
	const id = data?.chosen?.id;
	if (!id || !data?.pooled) return [];
	const splits = Object.values(data.pooled).flatMap((split) => (split[id] ? [split[id]] : []));
	const matches = splits.reduce((sum, split) => sum + split.n, 0);
	if (matches === 0) return [];
	const mean = (key: 'brier' | 'accuracy') =>
		splits.reduce((sum, split) => sum + split[key] * split.n, 0) / matches;
	return [
		{ label: 'Winners called', value: `${Math.round(mean('accuracy') * 1000) / 10}%` },
		{ label: 'Brier score', value: mean('brier').toFixed(3) },
		{ label: 'Matches replayed', value: integer(matches) }
	];
}

async function settle<T>(task: Promise<T>, ms: number): Promise<Settled<T>> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), ms);
	});
	const outcome = await Promise.race([
		task.then(
			(value) => ({ ok: true as const, value }),
			(error: unknown) => ({ ok: false as const, error })
		),
		timeout
	]);
	clearTimeout(timer);
	return outcome;
}

function valueOf<T>(outcome: Settled<T>): T | null {
	return outcome?.ok ? outcome.value : null;
}

function missing(outcome: Settled<unknown>): boolean {
	return Boolean(
		outcome && !outcome.ok && outcome.error instanceof DataError && outcome.error.status === 404
	);
}

function rankText(rank: number): string {
	return `${integer(rank)}${ordinal(rank).slice(String(rank).length)}`;
}

function seasonRecord(season: TeamSeason): string | null {
	const played = season.events.flatMap((entry) => (entry.stats ? [entry.stats] : []));
	if (played.length === 0) return null;
	const wins = played.reduce((sum, stats) => sum + stats.wins, 0);
	const losses = played.reduce((sum, stats) => sum + stats.losses, 0);
	const ties = played.reduce((sum, stats) => sum + stats.ties, 0);
	return record(wins, losses, ties);
}

export function teamStats(season: TeamSeason, ratings: SeasonRatings | null): Stat[] {
	const number = season.team.number;
	const rating = ratings?.teams.find((entry) => entry.team === number) ?? null;
	const stats: Stat[] = [];
	if (ratings && rating) {
		stats.push({ label: 'Season OPR', value: fixed(rating.opr, 1) });
		stats.push({
			label: `World rank of ${integer(ratings.teams.length)}`,
			value: rankText(rating.rank)
		});
	}
	const seasonResult = seasonRecord(season);
	if (seasonResult) stats.push({ label: 'Record', value: seasonResult });
	if (stats.length < 3) {
		const count = season.events.length;
		stats.push({
			label: count === 1 ? 'Event this season' : 'Events this season',
			value: String(count)
		});
	}
	if (stats.length < 3 && season.team.rookieYear) {
		stats.push({ label: 'Rookie year', value: String(season.team.rookieYear) });
	}
	return stats.slice(0, 3);
}

function teamName(bundle: EventBundle, number: number): string | null {
	return bundle.teams.find((team) => team.number === number)?.name ?? null;
}

function standout(bundle: EventBundle): Stat {
	const winners = bundle.awards
		.filter((award) => award.id === WINNER_AWARD_ID && award.team !== null)
		.map((award) => award.team as number);
	if (winners.length > 0) {
		return { label: 'Winning alliance', value: winners.join(' & ') };
	}
	const leader = bundle.rankings.find((entry) => entry.rank === 1);
	if (leader) {
		const name = teamName(bundle, leader.team) ?? leader.name ?? null;
		return { label: name ? `Ranked 1st, ${name}` : 'Ranked 1st', value: String(leader.team) };
	}
	return { label: 'Event type', value: bundle.event.typeName };
}

export function eventStats(bundle: EventBundle): Stat[] {
	const quals = bundle.matches.filter((match) => match.level === 'qual');
	const played = quals.filter((match) => match.result !== null).length;
	const status: Stat =
		bundle.phase === 'upcoming'
			? { label: 'Status', value: quals.length > 0 ? 'Schedule out' : 'Upcoming' }
			: bundle.phase === 'quals'
				? { label: 'Live now', value: quals.length > 0 ? `Q${played} of ${quals.length}` : 'Quals' }
				: bundle.phase === 'selection'
					? { label: 'Live now', value: 'Selection' }
					: bundle.phase === 'playoffs'
						? { label: 'Live now', value: 'Playoffs' }
						: { label: 'Status', value: 'Finished' };
	return [{ label: 'Teams', value: String(bundle.teams.length) }, status, standout(bundle)];
}

function eventMaxAge(bundle: EventBundle): number {
	if (bundle.phase === 'done') return DAY_SECONDS;
	if (bundle.phase === 'upcoming') return HOUR_SECONDS;
	return LIVE_SECONDS;
}

function alliance(bundle: EventBundle, match: Match, color: 'red' | 'blue'): AllianceLine {
	return {
		color,
		teams: match[color].map((entry) => ({
			number: entry.team,
			name: teamName(bundle, entry.team)
		})),
		score: match.result ? match.result[color].total : null,
		won: match.result?.winner === color
	};
}

export function matchNote(bundle: EventBundle, match: Match): string {
	const result = match.result;
	const zone = bundle.event.timezone;
	if (result) {
		const margin = Math.abs(result.red.total - result.blue.total);
		if (result.winner === null) return `Tied ${result.red.total}–${result.blue.total}`;
		const side = result.winner === 'red' ? 'Red' : 'Blue';
		return `${side} won by ${margin} ${margin === 1 ? 'point' : 'points'}`;
	}
	if (match.scheduledTime === null) return 'Not played yet';
	const clock = time(match.scheduledTime, zone).replace(/\s/g, ' ');
	return `Scheduled for ${shortDate(match.scheduledTime, zone)} at ${clock} local time`;
}

export function matchCardData(bundle: EventBundle, match: Match) {
	return {
		title: titleOf(match),
		event: bundle.event.name,
		alliances: [alliance(bundle, match, 'red'), alliance(bundle, match, 'blue')] as [
			AllianceLine,
			AllianceLine
		],
		note: matchNote(bundle, match)
	};
}

function matchMaxAge(bundle: EventBundle, match: Match, now: number): number {
	if (match.result) return bundle.phase === 'done' ? DAY_SECONDS : 6 * HOUR_SECONDS;
	return eventStatus(bundle.event, now) === 'live' ? LIVE_SECONDS : HOUR_SECONDS;
}

async function teamCardFor(number: number, host: string, deps: OgDeps, budget: number) {
	const [season, ratings] = await Promise.all([
		settle(deps.loadTeamSeason(number), budget),
		settle(deps.loadSeasonRatings(), budget)
	]);
	const found = valueOf(season);
	if (!found) {
		return {
			node: teamCard({ number, name: 'FTC team', place: null, stats: [] }, host),
			maxAge: 300
		};
	}
	const rated = valueOf(ratings);
	const card = {
		number,
		name: found.team.name,
		place: placeName(found.team) || null,
		stats: teamStats(found, rated)
	};
	return { node: teamCard(card, host), maxAge: rated ? HOUR_SECONDS : 300 };
}

async function eventCardFor(code: string, host: string, deps: OgDeps, budget: number) {
	const outcome = await settle(deps.loadEventBundle(code), budget);
	if (missing(outcome)) return null;
	const bundle = valueOf(outcome);
	if (!bundle) return { node: siteCard(host), maxAge: 60 };
	const { event } = bundle;
	const place = [event.typeName, placeName(event)].filter(Boolean).join(' in ');
	const card = {
		name: event.name,
		place: place || null,
		dates: dateRange(event.start, event.end, event.timezone),
		stats: eventStats(bundle)
	};
	return { node: eventCard(card, host), maxAge: eventMaxAge(bundle) };
}

async function matchCardFor(
	code: string,
	key: string,
	host: string,
	deps: OgDeps,
	budget: number,
	now: number
) {
	const outcome = await settle(deps.loadEventBundle(code), budget);
	if (missing(outcome)) return null;
	const bundle = valueOf(outcome);
	if (!bundle) return { node: siteCard(host), maxAge: 60 };
	const match = bundle.matches.find((entry) => entry.key === key);
	if (!match) return null;
	return {
		node: matchCard(matchCardData(bundle, match), host),
		maxAge: matchMaxAge(bundle, match, now)
	};
}

async function leaderboardCard(host: string, deps: OgDeps, budget: number) {
	const ratings = valueOf(await settle(deps.loadSeasonRatings(), budget));
	const title = `Top FTC teams by OPR, ${SEASON_NAME}`;
	if (!ratings || ratings.teams.length === 0) {
		return { node: pageCard({ kicker: 'Leaderboards', title }, host), maxAge: 300 };
	}
	const top = ratings.teams.toSorted((a, b) => a.rank - b.rank).slice(0, 3);
	const names = valueOf(
		await settle(
			deps.loadNames(
				top.map((entry) => entry.team),
				[]
			),
			budget
		)
	);
	const rows = top.map((entry) => ({
		rank: String(entry.rank),
		label: String(entry.team),
		detail: names?.teams[entry.team] ?? null,
		value: fixed(entry.opr, 1)
	}));
	const kicker = `Leaderboards · ${integer(ratings.teams.length)} teams rated`;
	return { node: listCard({ kicker, title, rows }, host), maxAge: 6 * HOUR_SECONDS };
}

async function recordsCard(host: string, deps: OgDeps, budget: number) {
	const title = `Highest FTC scores, ${SEASON_NAME}`;
	const top = valueOf(await settle(deps.loadTopRecords(3), budget));
	if (!top || top.length === 0) {
		return { node: pageCard({ kicker: 'Season records', title }, host), maxAge: 300 };
	}
	const names = valueOf(
		await settle(
			deps.loadNames(
				[],
				top.map((row) => row.event)
			),
			budget
		)
	);
	const rows = top.map((row) => ({
		rank: String(row.rank),
		label: row.teams.join(' & '),
		detail: names?.events[row.event] ?? row.event,
		value: String(row.total)
	}));
	return {
		node: listCard({ kicker: 'Season records', title, rows }, host),
		maxAge: 6 * HOUR_SECONDS
	};
}

async function compareCardFor(numbers: number[], host: string, deps: OgDeps, budget: number) {
	const [ratings, ...seasons] = await Promise.all([
		settle(deps.loadSeasonRatings(), budget),
		...numbers.map((number) => settle(deps.loadTeamSeason(number), budget))
	]);
	const rated = valueOf(ratings as Settled<SeasonRatings | null>);
	const columns: CompareColumn[] = numbers.map((number, index) => {
		const season = valueOf(seasons[index] as Settled<TeamSeason | null>);
		const rating = rated?.teams.find((entry) => entry.team === number) ?? null;
		const stats: Stat[] = rating
			? [
					{ label: 'OPR', value: fixed(rating.opr, 1) },
					{ label: 'world rank', value: rankText(rating.rank) }
				]
			: [];
		const result = season ? seasonRecord(season) : null;
		if (result) stats.push({ label: 'record', value: result });
		return { number, name: season?.team.name ?? 'FTC team', stats };
	});
	return { node: compareCard(columns, host), maxAge: rated ? HOUR_SECONDS : 300 };
}

export function simulationNote(simulation: Simulation): string {
	const { red, blue, tie } = simulation.forecast;
	const odds = `Predicted · ${colorName('red')} wins ${pct(red.win)}, ${colorName('blue')} ${pct(blue.win)}`;
	return tie >= 0.005 ? `${odds}, tie ${pct(tie)}` : odds;
}

async function simulateCardFor(sides: Sides, host: string, deps: OgDeps, budget: number) {
	const simulation = valueOf(await settle(deps.loadSimulation(sides), budget));
	const title = `${sides.red.join(' & ')} vs ${sides.blue.join(' & ')}`;
	if (!simulation) {
		return { node: pageCard({ kicker: 'Match simulator', title }, host), maxAge: 300 };
	}
	const line = (color: 'red' | 'blue'): AllianceLine => ({
		color,
		teams: simulation[color].teams.map((team) => ({ number: team.number, name: team.name })),
		score: Math.round(simulation[color].score),
		won: false
	});
	const card = {
		title,
		event: 'Match simulator',
		alliances: [line('red'), line('blue')] as [AllianceLine, AllianceLine],
		note: simulationNote(simulation)
	};
	return { node: matchCard(card, host), maxAge: HOUR_SECONDS };
}

export async function cardFor(
	path: string,
	host: string,
	deps: OgDeps,
	budget = 4000,
	now = Date.now()
): Promise<OgCard | null> {
	const shownHost = host.replace(/^www\./, '');
	if (path === 'site.png') return { node: siteCard(shownHost), maxAge: DAY_SECONDS };
	const page = PAGES[path];
	if (page) {
		const stats = path === 'accuracy.png' ? accuracyStats(Object.values(published)[0]) : [];
		return { node: pageCard({ ...page, stats }, shownHost), maxAge: DAY_SECONDS };
	}
	if (path === 'leaderboards.png') return leaderboardCard(shownHost, deps, budget);
	if (path === 'records.png') return recordsCard(shownHost, deps, budget);
	const team = TEAM_PATH.exec(path);
	if (team) return teamCardFor(Number(team[1]), shownHost, deps, budget);
	const event = EVENT_PATH.exec(path);
	if (event) return eventCardFor(event[1], shownHost, deps, budget);
	const match = MATCH_PATH.exec(path);
	if (match) return matchCardFor(match[1], match[2], shownHost, deps, budget, now);
	const simulate = SIMULATE_PATH.exec(path);
	if (simulate) {
		const [r1, r2, b1, b2] = simulate.slice(1).map(Number);
		if (new Set([r1, r2, b1, b2]).size < 4) return null;
		return simulateCardFor({ red: [r1, r2], blue: [b1, b2] }, shownHost, deps, budget);
	}
	const compare = COMPARE_PATH.exec(path);
	if (compare) {
		const numbers = [...new Set(compare[1].split('-').map(Number))];
		if (numbers.length < 2) return null;
		return compareCardFor(numbers, shownHost, deps, budget);
	}
	return null;
}
