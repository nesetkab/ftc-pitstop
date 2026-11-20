import type { SeasonRatings } from '#lib/analysis/types.ts';
import { placeName } from '#lib/components/team/places.ts';
import { dateRange, fixed, integer, ordinal, record } from '#lib/format/index.ts';
import { DataError } from '#lib/server/errors.ts';
import { eventCard, siteCard, teamCard, type OgNode, type Stat } from '#lib/server/og/cards.ts';
import type { EventBundle, TeamSeason } from '#lib/types.ts';

export interface OgDeps {
	loadTeamSeason(number: number): Promise<TeamSeason | null>;
	loadSeasonRatings(): Promise<SeasonRatings | null>;
	loadEventBundle(code: string): Promise<EventBundle>;
}

export interface OgCard {
	node: OgNode;
	maxAge: number;
}

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown } | null;

const TEAM_PATH = /^teams\/([1-9]\d{0,4})\.png$/;
const EVENT_PATH = /^events\/([A-Z0-9]{2,24})\.png$/;
const LIVE_SECONDS = 120;
const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86_400;

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
		stats.push({ label: 'OPR', value: fixed(rating.opr, 1) });
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
	return [
		{ label: 'Teams', value: String(bundle.teams.length) },
		{ label: 'Event type', value: bundle.event.typeName },
		status
	];
}

function eventMaxAge(bundle: EventBundle): number {
	if (bundle.phase === 'done') return DAY_SECONDS;
	if (bundle.phase === 'upcoming') return HOUR_SECONDS;
	return LIVE_SECONDS;
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
	if (
		outcome &&
		!outcome.ok &&
		outcome.error instanceof DataError &&
		outcome.error.status === 404
	) {
		return null;
	}
	const bundle = valueOf(outcome);
	if (!bundle) return { node: siteCard(host), maxAge: 60 };
	const { event } = bundle;
	const card = {
		name: event.name,
		place: placeName(event) || null,
		dates: dateRange(event.start, event.end, event.timezone),
		stats: eventStats(bundle)
	};
	return { node: eventCard(card, host), maxAge: eventMaxAge(bundle) };
}

export async function cardFor(
	path: string,
	host: string,
	deps: OgDeps,
	budget = 4000
): Promise<OgCard | null> {
	const shownHost = host.replace(/^www\./, '');
	if (path === 'site.png') return { node: siteCard(shownHost), maxAge: DAY_SECONDS };
	const team = TEAM_PATH.exec(path);
	if (team) return teamCardFor(Number(team[1]), shownHost, deps, budget);
	const event = EVENT_PATH.exec(path);
	if (event) return eventCardFor(event[1], shownHost, deps, budget);
	return null;
}
