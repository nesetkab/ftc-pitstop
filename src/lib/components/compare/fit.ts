import { fixed } from '#lib/format/index.ts';
import { PART_LABELS } from '#lib/game/biobuzz.ts';
import { calibratedSwarm, calibratedTips } from '#lib/model/rp.ts';

export const FIT_PARTS = [
	'auto',
	'teleop',
	'hive',
	'flower',
	'garden',
	'park',
	'leavePark',
	'tips'
] as const;

export type FitPart = (typeof FIT_PARTS)[number];

export type FitParts = Record<FitPart, number>;

export interface FitTeam {
	number: number;
	opr: number;
	parts: FitParts;
}

export interface FitChances {
	swarm: number;
	pollinator1: number;
	pollinator2: number;
}

export interface Alliance {
	teams: number[];
	score: number;
	parts: FitParts;
	chances: FitChances;
}

export interface Fit {
	teams: FitTeam[];
	missing: number[];
	average: FitParts;
	alliances: Alliance[];
	notes: string[];
}

export interface FitInput {
	numbers: number[];
	teams: FitTeam[];
	average: FitParts;
	robotSwarm: (teams: number[]) => number;
}

export const MIN_FIT = 2;
export const MAX_FIT = 3;

const SCORING = ['auto', 'hive', 'flower', 'garden', 'park'] as const;
const SPECIALIST_SHARE = 0.65;
const MEANINGFUL_SHARE = 0.1;
const MIN_TIPS = 1;
const MIN_AVERAGE = 3;
const MAX_NOTES = 4;
export const LEAD_SHARE = 0.6;
const LEAD_MIN_SHARE = 0.05;

const lower = (part: (typeof SCORING)[number]) => PART_LABELS[part].toLowerCase();

export function emptyParts(): FitParts {
	return Object.fromEntries(FIT_PARTS.map((part) => [part, 0])) as FitParts;
}

export function sumParts(list: FitParts[]): FitParts {
	const total = emptyParts();
	for (const parts of list) for (const part of FIT_PARTS) total[part] += parts[part];
	return total;
}

export function averageParts(list: FitParts[]): FitParts {
	const total = sumParts(list);
	if (list.length === 0) return total;
	for (const part of FIT_PARTS) total[part] /= list.length;
	return total;
}

export function pairsOf<T>(items: T[]): T[][] {
	const pairs: T[][] = [];
	for (let i = 0; i < items.length; i++)
		for (let j = i + 1; j < items.length; j++) pairs.push([items[i], items[j]]);
	return pairs;
}

export function alliance(teams: FitTeam[], robotSwarm: (teams: number[]) => number): Alliance {
	const numbers = teams.map((team) => team.number);
	const parts = sumParts(teams.map((team) => team.parts));
	const tips = calibratedTips(parts.tips);
	return {
		teams: numbers,
		score: teams.reduce((sum, team) => sum + team.opr, 0),
		parts,
		chances: {
			swarm: calibratedSwarm(robotSwarm(numbers), parts.leavePark),
			pollinator1: tips.pollinator1,
			pollinator2: tips.pollinator2
		}
	};
}

export function partLead(members: FitTeam[], part: FitPart, score: number): string | null {
	if (members.length === 0) return null;
	const total = members.reduce((sum, team) => sum + team.parts[part], 0);
	const floor = part === 'tips' ? 1 : Math.max(1, score * LEAD_MIN_SHARE);
	if (!(total >= floor)) return null;
	const top = members.reduce((a, b) => (b.parts[part] > a.parts[part] ? b : a));
	const share = Math.max(top.parts[part], 0) / total;
	return share >= LEAD_SHARE ? `${top.number} ${Math.round(Math.min(share, 1) * 100)}%` : null;
}

function list(items: string[]): string {
	if (items.length <= 1) return items.join('');
	return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function biggestPart(team: FitTeam): (typeof SCORING)[number] {
	return SCORING.reduce((best, part) => (team.parts[part] > team.parts[best] ? part : best));
}

function sourceNotes(teams: FitTeam[]): string[] {
	const groups = new Map<(typeof SCORING)[number], FitTeam[]>();
	for (const team of teams) {
		const part = biggestPart(team);
		if (team.parts[part] <= 0) continue;
		groups.set(part, [...(groups.get(part) ?? []), team]);
	}
	const shared = [...groups].filter(([, members]) => members.length >= 2);
	if (shared.length === 0) {
		if (groups.size < 2) return [];
		const each = teams.map((team) => `${team.number} ${lower(biggestPart(team))}`);
		return [`Each team's biggest part is different: ${list(each)}.`];
	}
	return shared.map(([part, members]) => {
		const who =
			members.length < teams.length
				? list(members.map((team) => String(team.number)))
				: teams.length === 2
					? 'both teams'
					: 'all three teams';
		const values = list(members.map((team) => fixed(team.parts[part])));
		return `${PART_LABELS[part]} is the biggest part for ${who} (${values} points).`;
	});
}

function specialistNotes(teams: FitTeam[]): string[] {
	const opr = teams.reduce((sum, team) => sum + team.opr, 0);
	const notes: string[] = [];
	for (const part of [...SCORING, 'tips'] as const) {
		const total = teams.reduce((sum, team) => sum + Math.max(team.parts[part], 0), 0);
		const meaningful = part === 'tips' ? total >= MIN_TIPS : total >= opr * MEANINGFUL_SHARE;
		if (!meaningful || total <= 0) continue;
		const top = teams.reduce((best, team) => (team.parts[part] > best.parts[part] ? team : best));
		const share = Math.max(top.parts[part], 0) / total;
		if (share < SPECIALIST_SHARE) continue;
		const unit = part === 'tips' ? 'tips' : `${lower(part)} points`;
		notes.push(`${top.number} brings ${Math.round(share * 100)}% of the combined ${unit}.`);
	}
	return notes;
}

function gapNotes(teams: FitTeam[], average: FitParts): string[] {
	const notes: string[] = [];
	for (const part of SCORING) {
		if (average[part] < MIN_AVERAGE) continue;
		if (!teams.every((team) => team.parts[part] < average[part])) continue;
		const who = teams.length === 2 ? 'Neither team' : 'None of these teams';
		const values = list(teams.map((team) => fixed(team.parts[part])));
		notes.push(
			`${who} is above average in ${lower(part)} (${values}, average ${fixed(average[part])}).`
		);
	}
	return notes;
}

export function fitNotes(teams: FitTeam[], average: FitParts): string[] {
	if (teams.length < MIN_FIT) return [];
	return [...sourceNotes(teams), ...specialistNotes(teams), ...gapNotes(teams, average)].slice(
		0,
		MAX_NOTES
	);
}

export function buildFit(input: FitInput): Fit | null {
	const { numbers, average, robotSwarm } = input;
	if (numbers.length < MIN_FIT || numbers.length > MAX_FIT) return null;
	const teams = numbers.flatMap((number) => input.teams.filter((team) => team.number === number));
	const missing = numbers.filter((number) => !teams.some((team) => team.number === number));
	const alliances = pairsOf(teams)
		.map((pair) => alliance(pair, robotSwarm))
		.sort((a, b) => b.score - a.score);
	return { teams, missing, average, alliances, notes: fitNotes(teams, average) };
}
