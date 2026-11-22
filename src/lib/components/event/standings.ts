import type { TeamRating } from '#lib/analysis/types.ts';
import { tips } from '#lib/game/biobuzz.ts';
import type { AllianceColor, Match, Ranking } from '#lib/types.ts';

const WIN_RP = 3;
const TIE_RP = 1;

export type RpCounts = {
	played: number;
	wins: number;
	ties: number;
	swarm: number;
	pollinator1: number;
	pollinator2: number;
};

type Tally = RpCounts & { team: number; rp: number; np: number; tips: number; auto: number };

export type RankShift = { before: number | null; after: number };

function order(matches: Match[]): Match[] {
	return matches
		.filter((match) => match.level === 'qual' && match.result !== null)
		.sort((a, b) => a.number - b.number);
}

function add(tallies: Map<number, Tally>, match: Match): void {
	const result = match.result;
	if (!result) return;
	for (const color of ['red', 'blue'] as AllianceColor[]) {
		const score = result[color];
		const rp = score.breakdown?.rp ?? null;
		const won = result.winner === color;
		const tied = result.winner === null;
		const earned =
			(won ? WIN_RP : tied ? TIE_RP : 0) +
			Number(rp?.swarm ?? false) +
			Number(rp?.pollinator1 ?? false) +
			Number(rp?.pollinator2 ?? false);
		for (const entry of match[color]) {
			if (entry.surrogate) continue;
			const row = tallies.get(entry.team) ?? {
				team: entry.team,
				played: 0,
				wins: 0,
				ties: 0,
				swarm: 0,
				pollinator1: 0,
				pollinator2: 0,
				rp: 0,
				np: 0,
				tips: 0,
				auto: 0
			};
			row.played += 1;
			tallies.set(entry.team, row);
			if (entry.dq || entry.noShow) continue;
			row.wins += Number(won);
			row.ties += Number(tied);
			row.swarm += Number(rp?.swarm ?? false);
			row.pollinator1 += Number(rp?.pollinator1 ?? false);
			row.pollinator2 += Number(rp?.pollinator2 ?? false);
			row.rp += earned;
			row.np += score.preFoulTotal;
			row.tips += score.breakdown ? tips(score.breakdown) : 0;
			row.auto += score.auto;
		}
	}
}

function tallyOf(matches: Match[]): Map<number, Tally> {
	const tallies = new Map<number, Tally>();
	for (const match of matches) add(tallies, match);
	return tallies;
}

function ranks(tallies: Map<number, Tally>): Map<number, number> {
	const avg = (row: Tally, value: number) => value / Math.max(1, row.played);
	const sorted = [...tallies.values()].sort(
		(a, b) =>
			avg(b, b.rp) - avg(a, a.rp) ||
			avg(b, b.np) - avg(a, a.np) ||
			avg(b, b.tips) - avg(a, a.tips) ||
			avg(b, b.auto) - avg(a, a.auto) ||
			a.team - b.team
	);
	return new Map(sorted.map((row, index) => [row.team, index + 1]));
}

export function hasRpDetail(matches: Match[]): boolean {
	const played = order(matches);
	return (
		played.length > 0 &&
		played.every((match) => match.result?.red.breakdown && match.result.blue.breakdown)
	);
}

export function localRankings(
	matches: Match[],
	rankings: Pick<Ranking, 'team' | 'played'>[]
): boolean {
	const tallies = tallyOf(order(matches));
	return rankings.every((row) => row.played <= (tallies.get(row.team)?.played ?? 0));
}

export function rpCounts(matches: Match[]): Record<number, RpCounts> | null {
	if (!hasRpDetail(matches)) return null;
	const counts: Record<number, RpCounts> = {};
	for (const row of tallyOf(order(matches)).values()) {
		const { played, wins, ties, swarm, pollinator1, pollinator2 } = row;
		counts[row.team] = { played, wins, ties, swarm, pollinator1, pollinator2 };
	}
	return counts;
}

export function standingsAfter(matches: Match[], key?: string): Map<number, number> {
	const played = order(matches);
	const stop = key === undefined ? played.length : played.findIndex((match) => match.key === key);
	return ranks(tallyOf(played.slice(0, stop < 0 ? played.length : stop + 1)));
}

export function rankShifts(matches: Match[], key: string): Map<number, RankShift> | null {
	const played = order(matches);
	const index = played.findIndex((match) => match.key === key);
	if (index < 0 || !hasRpDetail(matches)) return null;
	const tallies = tallyOf(played.slice(0, index));
	const before = ranks(tallies);
	add(tallies, played[index]);
	const after = ranks(tallies);
	const shifts = new Map<number, RankShift>();
	for (const color of ['red', 'blue'] as AllianceColor[]) {
		for (const entry of played[index][color]) {
			const rank = after.get(entry.team);
			if (entry.surrogate || rank === undefined) continue;
			shifts.set(entry.team, { before: before.get(entry.team) ?? null, after: rank });
		}
	}
	return shifts;
}

export type OprShift = { before: number; after: number };

export function oprShifts(
	ratings: Pick<TeamRating, 'team' | 'prior' | 'history'>[],
	key: string
): Record<number, OprShift> | null {
	const shifts: Record<number, OprShift> = {};
	let found = false;
	for (const rating of ratings) {
		const index = rating.history.findIndex((point) => point.key === key);
		if (index < 0) continue;
		found = true;
		const before = index > 0 ? rating.history[index - 1].opr : rating.prior;
		shifts[rating.team] = { before, after: rating.history[index].opr };
	}
	return found ? shifts : null;
}
