import type { RpChances, TeamRating } from '#lib/analysis/types.ts';
import type { Stakes } from '#lib/components/event/stakes.ts';
import { fixed } from '#lib/format/number.ts';
import { pct } from '#lib/format/pct.ts';
import { PART_LABELS } from '#lib/game/biobuzz.ts';
import type { AllianceColor } from '#lib/types.ts';
import type { NextMatch, TeamSlot } from './view.ts';

export const BRIEF_PARTS = ['opr', 'auto', 'hive', 'tips'] as const;

export type BriefPart = (typeof BRIEF_PARTS)[number];

export const BRIEF_LABELS: Record<BriefPart, string> = {
	opr: 'OPR',
	auto: PART_LABELS.auto,
	hive: PART_LABELS.hive,
	tips: PART_LABELS.tips
};

const EDGE: Record<BriefPart, number> = { opr: 8, auto: 4, hive: 4, tips: 0.75 };
const STRONG: Record<BriefPart, number> = { opr: 0, auto: 3, hive: 3, tips: 0.5 };
const MAX_NOTES = 4;
const MAX_EDGES = 2;

export type PartValues = Record<BriefPart, number>;

export interface BriefTeam {
	number: number;
	name: string | null;
	rank: number | null;
	me: boolean;
	values: PartValues | null;
	best: BriefPart[];
}

export interface BriefSide {
	color: AllianceColor;
	teams: BriefTeam[];
	totals: PartValues | null;
	score: number | null;
	win: number | null;
	rp: RpChances | null;
}

export interface MatchBrief {
	key: string;
	label: string;
	ours: BriefSide;
	theirs: BriefSide;
	notes: string[];
}

export interface StakeLine {
	spots: number;
	now: number;
	win: number;
	loss: number;
}

function valuesOf(rating: TeamRating | undefined): PartValues | null {
	if (!rating) return null;
	return {
		opr: rating.opr,
		auto: rating.parts.auto,
		hive: rating.parts.hive,
		tips: rating.parts.tips
	};
}

function totalOf(teams: BriefTeam[]): PartValues | null {
	if (teams.length === 0 || teams.some((team) => team.values === null)) return null;
	const totals: PartValues = { opr: 0, auto: 0, hive: 0, tips: 0 };
	for (const team of teams) {
		for (const part of BRIEF_PARTS) totals[part] += team.values![part];
	}
	return totals;
}

function amount(part: BriefPart, value: number): string {
	if (part === 'tips') {
		const count = fixed(value, 1);
		return `${count} ${count === '1.0' ? 'tip' : 'tips'}`;
	}
	return `${Math.round(value)} points`;
}

const PHRASE: Record<BriefPart, string> = {
	opr: 'overall',
	auto: 'in auto',
	hive: 'at the hive',
	tips: 'on tips'
};

function edgeNotes(ours: PartValues | null, theirs: PartValues | null): string[] {
	if (!ours || !theirs) return [];
	const edges = BRIEF_PARTS.map((part) => ({ part, gap: ours[part] - theirs[part] }))
		.filter(({ part, gap }) => Math.abs(gap) >= EDGE[part])
		.sort((a, b) => Math.abs(b.gap) / EDGE[b.part] - Math.abs(a.gap) / EDGE[a.part])
		.slice(0, MAX_EDGES);
	if (edges.length === 0) {
		return ours.opr > 0 && theirs.opr > 0 ? ['The alliances are evenly matched on paper.'] : [];
	}
	return edges.map(({ part, gap }) =>
		gap > 0
			? `We're stronger ${PHRASE[part]}, by about ${amount(part, gap)}.`
			: `They're stronger ${PHRASE[part]}, by about ${amount(part, -gap)}.`
	);
}

function leaderNotes(teams: BriefTeam[]): string[] {
	return teams.flatMap((team) => {
		const parts = (['auto', 'hive', 'tips'] as const).filter((part) => team.best.includes(part));
		if (parts.length === 0) return [];
		const names = parts.map((part) => BRIEF_LABELS[part].toLowerCase());
		const list =
			names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
		return [`${team.me ? 'We have' : `${team.number} has`} the best ${list} on the field.`];
	});
}

function markBest(teams: BriefTeam[]) {
	for (const part of BRIEF_PARTS) {
		const rated = teams.filter((team) => team.values !== null);
		if (rated.length < 2) continue;
		const top = Math.max(...rated.map((team) => team.values![part]));
		if (top <= STRONG[part]) continue;
		const leaders = rated.filter((team) => team.values![part] === top);
		if (leaders.length === 1) leaders[0].best.push(part);
	}
}

export function matchBrief(next: NextMatch, ratings: TeamRating[]): MatchBrief {
	const byTeam = new Map(ratings.map((rating) => [rating.team, rating]));
	const team = (slot: TeamSlot): BriefTeam => ({
		number: slot.number,
		name: slot.name,
		rank: slot.rank,
		me: slot.me,
		values: valuesOf(byTeam.get(slot.number)),
		best: []
	});
	const other = next.alliance === 'red' ? 'blue' : 'red';
	const side = (color: AllianceColor): BriefSide => {
		const teams = [...next[color]]
			.sort((a, b) => Number(b.me) - Number(a.me))
			.map((slot) => team(slot));
		const forecast = next.forecast?.[color] ?? null;
		return {
			color,
			teams,
			totals: totalOf(teams),
			score: forecast?.score ?? null,
			win: forecast?.win ?? null,
			rp: forecast?.rp ?? null
		};
	};
	const ours = side(next.alliance);
	const theirs = side(other);
	markBest([...ours.teams, ...theirs.teams]);
	return {
		key: next.key,
		label: next.label,
		ours,
		theirs,
		notes: [
			...edgeNotes(ours.totals, theirs.totals),
			...leaderNotes([...ours.teams, ...theirs.teams])
		].slice(0, MAX_NOTES)
	};
}

export function stakeLine(stakes: Stakes | null, team: number): StakeLine | null {
	const row = stakes?.teams.find((entry) => entry.team === team);
	if (!stakes || !row) return null;
	return { spots: stakes.spots, now: row.now, win: row.win, loss: row.loss };
}

export function stakeText(line: StakeLine): string {
	return `Chance to finish top ${line.spots}: ${pct(line.now)} now, ${pct(line.win)} with a win, ${pct(line.loss)} with a loss.`;
}
