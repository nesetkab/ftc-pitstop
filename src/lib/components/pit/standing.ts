import { ordinal } from '#lib/format/ordinal.ts';
import type { Outcome, PitView } from './view.ts';

export interface RankMemory {
	posted: number;
	rank: number;
	previous: number | null;
}

export interface LastMatch {
	key: string;
	label: string;
	outcome: Outcome;
	ours: number;
	theirs: number;
	partners: number[];
	opponents: number[];
	rank: number | null;
	move: number | null;
}

export const RANK_KEY = 'ps-pit-rank';

export function postedQuals(view: PitView): number {
	return view.matches.filter((match) => match.level === 'qual' && match.outcome !== null).length;
}

export function rememberRank(
	memory: RankMemory | null,
	posted: number,
	rank: number | null
): RankMemory | null {
	if (rank === null) return memory;
	if (!memory || posted < memory.posted || posted > memory.posted + 1) {
		return { posted, rank, previous: null };
	}
	if (posted === memory.posted) {
		return memory.rank === rank ? memory : { ...memory, rank };
	}
	return { posted, rank, previous: memory.rank };
}

export function parseRankMemory(raw: string | null): RankMemory | null {
	if (!raw) return null;
	try {
		const value = JSON.parse(raw) as Partial<RankMemory>;
		const whole = (input: unknown): input is number => Number.isInteger(input);
		if (!whole(value.posted) || !whole(value.rank)) return null;
		return {
			posted: value.posted,
			rank: value.rank,
			previous: whole(value.previous) ? value.previous : null
		};
	} catch {
		return null;
	}
}

export function lastMatch(view: PitView, memory: RankMemory | null): LastMatch | null {
	const last = view.matches.findLast((match) => match.outcome !== null && match.score !== null);
	if (!last?.outcome || !last.score) return null;
	const rank = last.level === 'qual' ? (view.ranking?.rank ?? null) : null;
	const known =
		rank !== null &&
		memory !== null &&
		memory.previous !== null &&
		memory.posted === postedQuals(view) &&
		memory.rank === rank;
	return {
		key: last.key,
		label: last.label,
		outcome: last.outcome,
		ours: last.score.ours,
		theirs: last.score.theirs,
		partners: last.partners,
		opponents: last.opponents,
		rank,
		move: known ? memory.previous! - rank : null
	};
}

export function moveText(last: LastMatch): string | null {
	if (last.rank === null) return null;
	const now = ordinal(last.rank);
	if (last.move === null) return `Ranked ${now}.`;
	if (last.move === 0) return `Still ${now}.`;
	const places = Math.abs(last.move) === 1 ? 'place' : 'places';
	return `${last.move > 0 ? 'Up' : 'Down'} ${Math.abs(last.move)} ${places} to ${now}.`;
}
