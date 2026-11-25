import type { MatchForecast } from '#lib/analysis/types.ts';
import { parseTeamList } from '#lib/components/compare/compare.ts';
import type { FitParts } from '#lib/components/compare/fit.ts';
import { fixed, integer } from '#lib/format/index.ts';
import { pct } from '#lib/format/pct.ts';
import { PART_LABELS, RP_THRESHOLDS } from '#lib/game/biobuzz.ts';

export const SIDE_SIZE = 2;
export const COLORS = ['red', 'blue'] as const;

export type Color = (typeof COLORS)[number];

export type Sides = Record<Color, number[]>;

export interface SimTeam {
	number: number;
	name: string | null;
	opr: number;
	rated: boolean;
	parts: FitParts;
}

export interface SimSide {
	color: Color;
	teams: SimTeam[];
	score: number;
	np: number;
	fouls: number;
	low: number;
	high: number;
	parts: FitParts;
}

export interface Simulation {
	red: SimSide;
	blue: SimSide;
	forecast: MatchForecast;
	margin: number;
	marginSd: number;
	notes: string[];
}

export const SLOT_FIELDS: Record<Color, [string, string]> = {
	red: ['r1', 'r2'],
	blue: ['b1', 'b2']
};

export const SCORING_PARTS = ['auto', 'hive', 'flower', 'garden', 'park'] as const;

export const RANGE_Z = 1.2816;

const EVEN_PART = 3;
const CLOSE_WIN = 0.15;
const RP_GAP = 0.25;
const MAX_NOTES = 3;

export const colorName = (color: Color) => (color === 'red' ? 'Red' : 'Blue');

export const otherColor = (color: Color): Color => (color === 'red' ? 'blue' : 'red');

export function parseSides(params: URLSearchParams): Sides {
	const [r1, r2] = SLOT_FIELDS.red.map((field) => params.get(field));
	const [b1, b2] = SLOT_FIELDS.blue.map((field) => params.get(field));
	const red = parseTeamList(params.get('red'), r1, r2).slice(0, SIDE_SIZE);
	const blue = parseTeamList(params.get('blue'), b1, b2)
		.filter((number) => !red.includes(number))
		.slice(0, SIDE_SIZE);
	return { red, blue };
}

export function sidesFrom(red: readonly number[], blue: readonly number[]): Sides {
	const reds = [...new Set(red)].slice(0, SIDE_SIZE);
	const blues = [...new Set(blue)].filter((number) => !reds.includes(number)).slice(0, SIDE_SIZE);
	return { red: reds, blue: blues };
}

export function simulateHref(sides: Sides): string {
	const query = COLORS.filter((color) => sides[color].length > 0)
		.map((color) => `${color}=${sides[color].join(',')}`)
		.join('&');
	return query ? `/simulate?${query}` : '/simulate';
}

export function isCanonical(params: URLSearchParams, sides: Sides): boolean {
	const keys = [...params.keys()];
	if (new Set(keys).size < keys.length) return false;
	if (keys.some((key) => !COLORS.includes(key as Color))) return false;
	return COLORS.every((color) => {
		const given = params.get(color);
		return given === null ? sides[color].length === 0 : given === sides[color].join(',');
	});
}

export function isFull(sides: Sides): boolean {
	return COLORS.every((color) => sides[color].length === SIDE_SIZE);
}

export function withoutTeam(sides: Sides, number: number): Sides {
	return {
		red: sides.red.filter((team) => team !== number),
		blue: sides.blue.filter((team) => team !== number)
	};
}

export function swapped(sides: Sides): Sides {
	return { red: sides.blue, blue: sides.red };
}

export function scoreRange(score: number, sd: number): { low: number; high: number } {
	const spread = RANGE_Z * Math.max(sd, 0);
	return { low: Math.max(0, score - spread), high: score + spread };
}

function partWord(part: (typeof SCORING_PARTS)[number]): string {
	return PART_LABELS[part].toLowerCase();
}

function gaps(red: SimSide, blue: SimSide) {
	return SCORING_PARTS.map((part) => ({ part, gap: red.parts[part] - blue.parts[part] })).sort(
		(a, b) => Math.abs(b.gap) - Math.abs(a.gap)
	);
}

function gapNote(red: SimSide, blue: SimSide): string {
	const [top] = gaps(red, blue);
	if (Math.abs(top.gap) < EVEN_PART) {
		return `Every scoring part is within ${EVEN_PART} points, so no single part separates them.`;
	}
	const ahead = top.gap > 0 ? red : blue;
	const behind = top.gap > 0 ? blue : red;
	const word = partWord(top.part);
	return `${PART_LABELS[top.part]} is the biggest gap. ${colorName(ahead.color)} should score ${fixed(ahead.parts[top.part])} ${word} points to ${colorName(behind.color)}'s ${fixed(behind.parts[top.part])}.`;
}

function closeNote(margin: number, marginSd: number): string {
	const points = Math.round(Math.abs(margin)) === 1 ? 'point' : 'points';
	return `This is close to a coin flip. The expected margin of ${integer(Math.abs(margin))} ${points} is small next to a normal swing of about ${integer(marginSd)}.`;
}

function underdogNote(underdog: SimSide, favorite: SimSide): string {
	const leads = SCORING_PARTS.map((part) => ({
		part,
		gap: underdog.parts[part] - favorite.parts[part]
	}))
		.filter((entry) => entry.gap >= EVEN_PART)
		.sort((a, b) => b.gap - a.gap);
	const name = colorName(underdog.color);
	if (leads.length === 0) {
		return `${name} doesn't clearly lead any scoring part, so it needs ${colorName(favorite.color)} to have an off match.`;
	}
	const [best] = leads;
	return `${name}'s best chance is ${partWord(best.part)}, where it should lead by ${fixed(best.gap)} points.`;
}

function rpNote(red: SimSide, blue: SimSide, forecast: MatchForecast): string | null {
	const options = (['pollinator1', 'swarm', 'pollinator2'] as const)
		.map((key) => ({ key, gap: forecast.red.rp[key] - forecast.blue.rp[key] }))
		.filter((entry) => Math.abs(entry.gap) >= RP_GAP)
		.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
	if (options.length === 0) return null;
	const { key, gap } = options[0];
	const ahead = gap > 0 ? red : blue;
	const behind = gap > 0 ? blue : red;
	if (key === 'swarm') {
		return `Swarm separates them. It takes ${RP_THRESHOLDS.swarm} leave and park points, and ${colorName(ahead.color)} averages ${fixed(ahead.parts.leavePark)} to ${colorName(behind.color)}'s ${fixed(behind.parts.leavePark)}.`;
	}
	const label = key === 'pollinator1' ? 'Pollinator 1' : 'Pollinator 2';
	const need = key === 'pollinator1' ? RP_THRESHOLDS.pollinator1 : RP_THRESHOLDS.pollinator2;
	return `${label} separates them. It takes ${need} tips, and ${colorName(ahead.color)} averages ${fixed(ahead.parts.tips)} to ${colorName(behind.color)}'s ${fixed(behind.parts.tips)}.`;
}

export function decisionNotes(
	red: SimSide,
	blue: SimSide,
	forecast: MatchForecast,
	margin: number,
	marginSd: number
): string[] {
	const close = Math.abs(forecast.red.win - forecast.blue.win) < CLOSE_WIN;
	const favorite = forecast.red.win >= forecast.blue.win ? red : blue;
	const underdog = favorite === red ? blue : red;
	const notes = [
		close ? closeNote(margin, marginSd) : null,
		gapNote(red, blue),
		close ? null : underdogNote(underdog, favorite),
		rpNote(red, blue, forecast)
	];
	return notes.filter((note): note is string => note !== null).slice(0, MAX_NOTES);
}

export function headline(simulation: Pick<Simulation, 'forecast'>): {
	lead: string;
	rest: string;
} {
	const { red, blue, tie } = simulation.forecast;
	const tieText = tie >= 0.005 ? ` The chance of a tie is ${pct(tie)}.` : '';
	if (Math.abs(red.win - blue.win) < CLOSE_WIN) {
		return {
			lead: 'Too close to call.',
			rest: `Red wins ${pct(red.win)} of the time and Blue wins ${pct(blue.win)}.${tieText}`
		};
	}
	const favorite = red.win > blue.win ? 'Red' : 'Blue';
	const [first, second] = red.win > blue.win ? [red, blue] : [blue, red];
	const other = favorite === 'Red' ? 'Blue' : 'Red';
	return {
		lead: `${favorite} is favored.`,
		rest: `It wins ${pct(first.win)} of the time and ${other} wins ${pct(second.win)}.${tieText}`
	};
}
