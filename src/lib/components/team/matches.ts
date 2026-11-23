import { breakdownParts } from '#lib/game/biobuzz.ts';
import type { AllianceColor, EventBundle, Match, TeamSeason } from '#lib/types.ts';

export type MatchOutcome = 'win' | 'loss' | 'tie';

export interface TeamMatchParts {
	auto: number;
	hive: number;
	flower: number;
	garden: number;
	park: number;
}

export interface TeamMatchRow {
	key: string;
	label: string;
	alliance: AllianceColor;
	partners: number[];
	opponents: number[];
	score: number | null;
	against: number | null;
	outcome: MatchOutcome | null;
	parts: TeamMatchParts | null;
	surrogate: boolean;
}

export interface TeamMatchEvent {
	code: string;
	name: string;
	start: string;
	end: string;
	record: { wins: number; losses: number; ties: number };
	rows: TeamMatchRow[];
}

type MatchBundles = Record<string, Pick<EventBundle, 'matches'> | null>;

function rowFor(match: Match, team: number): TeamMatchRow | null {
	const alliance: AllianceColor | null = match.red.some((entry) => entry.team === team)
		? 'red'
		: match.blue.some((entry) => entry.team === team)
			? 'blue'
			: null;
	if (!alliance) return null;
	const other: AllianceColor = alliance === 'red' ? 'blue' : 'red';
	const own = match[alliance];
	const seat = own.find((entry) => entry.team === team);
	const result = match.result;
	const mine = result?.[alliance] ?? null;
	const theirs = result?.[other] ?? null;
	return {
		key: match.key,
		label: match.label,
		alliance,
		partners: own.filter((entry) => entry.team !== team).map((entry) => entry.team),
		opponents: match[other].map((entry) => entry.team),
		score: mine?.total ?? null,
		against: theirs?.total ?? null,
		outcome: result
			? result.winner === alliance
				? 'win'
				: result.winner === other
					? 'loss'
					: 'tie'
			: null,
		parts: mine?.breakdown ? partsOf(breakdownParts(mine)) : null,
		surrogate: seat?.surrogate ?? false
	};
}

function partsOf(parts: TeamMatchParts): TeamMatchParts {
	return {
		auto: parts.auto,
		hive: parts.hive,
		flower: parts.flower,
		garden: parts.garden,
		park: parts.park
	};
}

export function teamMatches(
	season: TeamSeason,
	bundles: MatchBundles,
	team: number
): TeamMatchEvent[] {
	return season.events
		.flatMap<TeamMatchEvent>(({ event }) => {
			const bundle = bundles[event.code];
			if (!bundle) return [];
			const rows = bundle.matches
				.map((match) => rowFor(match, team))
				.filter((row): row is TeamMatchRow => row !== null);
			if (rows.length === 0) return [];
			const record = { wins: 0, losses: 0, ties: 0 };
			for (const row of rows) {
				if (row.surrogate) continue;
				if (row.outcome === 'win') record.wins += 1;
				else if (row.outcome === 'loss') record.losses += 1;
				else if (row.outcome === 'tie') record.ties += 1;
			}
			return [
				{ code: event.code, name: event.name, start: event.start, end: event.end, record, rows }
			];
		})
		.sort((a, b) => b.start.localeCompare(a.start) || a.name.localeCompare(b.name));
}
