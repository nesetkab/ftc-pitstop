import { addDays } from '#lib/components/team/dates.ts';
import { matchDay } from '#lib/components/records/records.ts';
import { matchLabel, parseMatchKey } from '#lib/format/match.ts';
import type { AllianceColor, SeasonMatch, SeasonMatchAlliance } from '#lib/types.ts';

export type HighlightRange = 'today' | 'week';

export interface Highlight {
	event: string;
	key: string;
	label: string;
	red: number[];
	blue: number[];
	redScore: number;
	blueScore: number;
	winner: AllianceColor | null;
	chance: number | null;
}

export interface Highlights {
	range: HighlightRange;
	highest: Highlight[];
	closest: Highlight[];
	upsets: Highlight[];
}

export interface HighlightNames {
	teams: Record<number, string>;
	events: Record<string, string>;
}

export const HIGHLIGHT_COUNT = 3;
export const TODAY_MINIMUM = 12;
const UPSET_CHANCE = 0.4;
const PLAUSIBLE_SCORE = 600;

export type WinnerChance = (match: SeasonMatch, winner: AllianceColor) => number | null;

function plausible(alliance: SeasonMatchAlliance): boolean {
	return (
		alliance.total <= PLAUSIBLE_SCORE &&
		Math.abs(alliance.auto + alliance.teleop - alliance.preFoulTotal) <= 1
	);
}

function winnerOf(match: SeasonMatch): AllianceColor | null {
	if (match.red.total === match.blue.total) return null;
	return match.red.total > match.blue.total ? 'red' : 'blue';
}

function highlight(match: SeasonMatch, chance: number | null): Highlight {
	const parsed = parseMatchKey(match.key);
	return {
		event: match.eventCode,
		key: match.key,
		label: parsed ? matchLabel(parsed) : match.key.toUpperCase(),
		red: match.red.teams,
		blue: match.blue.teams,
		redScore: match.red.total,
		blueScore: match.blue.total,
		winner: winnerOf(match),
		chance
	};
}

const top = (match: SeasonMatch) => Math.max(match.red.total, match.blue.total);
const combined = (match: SeasonMatch) => match.red.total + match.blue.total;
const margin = (match: SeasonMatch) => Math.abs(match.red.total - match.blue.total);

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function buildHighlights(
	matches: SeasonMatch[],
	today: string,
	chanceOf: WinnerChance
): Highlights | null {
	const played = matches.filter(
		(match) =>
			match.red.teams.length > 0 &&
			match.blue.teams.length > 0 &&
			combined(match) > 0 &&
			plausible(match.red) &&
			plausible(match.blue)
	);
	const since = addDays(today, -6);
	const days = new Map(played.map((match) => [match, matchDay(match)]));
	const ofToday = played.filter((match) => days.get(match) === today);
	const range: HighlightRange = ofToday.length >= TODAY_MINIMUM ? 'today' : 'week';
	const pool =
		range === 'today'
			? ofToday
			: played.filter((match) => {
					const day = days.get(match)!;
					return day >= since && day <= today;
				});
	if (pool.length === 0) return null;

	const highest = [...pool]
		.sort((a, b) => top(b) - top(a) || combined(b) - combined(a))
		.slice(0, HIGHLIGHT_COUNT)
		.map((match) => highlight(match, null));

	const floor = median(pool.map(combined));
	const closest = pool
		.filter((match) => combined(match) >= floor)
		.sort((a, b) => margin(a) - margin(b) || combined(b) - combined(a))
		.slice(0, HIGHLIGHT_COUNT)
		.map((match) => highlight(match, null));

	const upsets = pool
		.flatMap((match) => {
			const winner = winnerOf(match);
			const chance = winner ? chanceOf(match, winner) : null;
			return chance !== null && chance < UPSET_CHANCE ? [{ match, chance }] : [];
		})
		.sort((a, b) => a.chance - b.chance || combined(b.match) - combined(a.match))
		.slice(0, HIGHLIGHT_COUNT)
		.map(({ match, chance }) => highlight(match, chance));

	return { range, highest, closest, upsets };
}
