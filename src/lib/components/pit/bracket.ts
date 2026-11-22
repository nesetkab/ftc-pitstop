import {
	bracketFor,
	resolveBracket,
	type AllianceCount,
	type Color,
	type Source
} from '#lib/model/bracket.ts';
import type { AllianceColor, AllianceSelection, Match, MatchTeam } from '#lib/types.ts';

export type Pending = Map<string, Partial<Record<AllianceColor, string>>>;

export interface FilledPlayoffs {
	matches: Match[];
	pending: Pending;
}

const SECTION = { upper: 'Upper', lower: 'Lower', final: 'Final' } as const;

function lineup(alliance: AllianceSelection): number[] {
	const { backup, backupReplaced } = alliance;
	return [alliance.captain, ...alliance.picks].map((team) =>
		backup && team === backupReplaced ? backup : team
	);
}

function seats(teams: number[]): MatchTeam[] {
	return teams.map((team, index) => ({
		team,
		station: index + 1,
		surrogate: false,
		noShow: false,
		dq: false,
		onField: true
	}));
}

function describe(source: Source): string {
	if ('seed' in source) return `Alliance ${source.seed}`;
	if ('winnerOf' in source) return `Winner of M${source.winnerOf}`;
	return `Loser of M${source.loserOf}`;
}

function byOrder(a: Match, b: Match): number {
	if (a.level !== b.level) return a.level === 'qual' ? -1 : 1;
	return a.series - b.series || a.number - b.number;
}

function projected(
	series: number,
	number: number,
	description: string,
	label: string,
	red: number[],
	blue: number[]
): Match {
	return {
		key: label.toLowerCase().replace(/^[mf]/, 'p'),
		level: 'playoff',
		series,
		number,
		label,
		description,
		scheduledTime: null,
		actualTime: null,
		postedTime: null,
		red: seats(red),
		blue: seats(blue),
		result: null
	};
}

function fillFinals(matches: Match[], playoffs: Match[]): Match[] {
	const last = playoffs.at(-1)!;
	if (playoffs.some((match) => match.result === null)) return matches;
	if (last.red.length === 0 || last.blue.length === 0) return matches;
	const wins = new Map<number, number>();
	for (const match of playoffs) {
		const winner = match.result?.winner;
		if (!winner) continue;
		const captain = match[winner][0].team;
		wins.set(captain, (wins.get(captain) ?? 0) + 1);
	}
	if ([...wins.values()].some((count) => count >= 2)) return matches;
	const number = Math.max(...playoffs.map((match) => match.number)) + 1;
	const next = projected(
		last.series,
		number,
		`Finals ${number}`,
		`F${number}`,
		last.red.map((slot) => slot.team),
		last.blue.map((slot) => slot.team)
	);
	return [...matches, next];
}

export function fillPlayoffs(matches: Match[], alliances: AllianceSelection[]): FilledPlayoffs {
	const none: FilledPlayoffs = { matches, pending: new Map() };
	const playoffs = matches.filter((match) => match.level === 'playoff');
	const size = alliances.length;
	if (playoffs.length === 0 || ![2, 4, 6, 8].includes(size)) return none;
	const bySeed = new Map(alliances.map((alliance) => [alliance.seed, alliance]));
	if (alliances.some((_, index) => !bySeed.has(index + 1))) return none;
	if (size === 2) return { matches: fillFinals(matches, playoffs), pending: new Map() };
	const count = size as AllianceCount;
	const rows = new Map(bracketFor(count).map((row) => [row.match, row]));
	if (playoffs.some((match) => !rows.has(match.series))) return none;
	const seedOf = new Map<number, number>();
	for (const alliance of alliances) {
		for (const team of [alliance.captain, ...alliance.picks, alliance.backup]) {
			if (team) seedOf.set(team, alliance.seed);
		}
	}
	const sideSeed = (slots: MatchTeam[]) =>
		slots.map((slot) => seedOf.get(slot.team)).find((seed) => seed !== undefined) ?? null;
	const results = new Map<number, Color>();
	for (const match of playoffs) {
		const winner = match.result?.winner;
		if (!winner) continue;
		const slot = resolveBracket(count, results).matches.find((row) => row.match === match.series);
		const seed = sideSeed(match[winner]);
		if (seed === null || !slot) return none;
		if (seed === slot.redAlliance) results.set(match.series, 'red');
		else if (seed === slot.blueAlliance) results.set(match.series, 'blue');
		else return none;
	}
	const state = resolveBracket(count, results);
	const filled = [...matches];
	const pending: Pending = new Map();
	for (const row of state.matches) {
		if (row.needed === false) continue;
		const listed = playoffs.filter((match) => match.series === row.match);
		const open = listed.find((match) => match.result === null);
		const expected = { red: row.redAlliance, blue: row.blueAlliance };
		if (open) {
			const seen = { red: sideSeed(open.red), blue: sideSeed(open.blue) };
			const known = [seen.red, seen.blue].filter((seed) => seed !== null);
			if (known.some((seed) => seed !== expected.red && seed !== expected.blue)) return none;
			const flipped =
				(seen.red !== null && seen.red === expected.blue) ||
				(seen.blue !== null && seen.blue === expected.red);
			const gaps: Partial<Record<AllianceColor, string>> = {};
			const next = { ...open };
			for (const color of ['red', 'blue'] as const) {
				if (open[color].length > 0) continue;
				const from = flipped ? (color === 'red' ? 'blue' : 'red') : color;
				const seed = expected[from];
				if (seed !== null && !known.includes(seed)) next[color] = seats(lineup(bySeed.get(seed)!));
				else gaps[color] = describe(row[from]);
			}
			filled[filled.indexOf(open)] = next;
			if (gaps.red || gaps.blue) pending.set(open.key, gaps);
			continue;
		}
		if (row.needed !== true || row.winner !== null) continue;
		if (listed.some((match) => match.result?.winner)) continue;
		if (expected.red === null && expected.blue === null) continue;
		const number = listed.length > 0 ? Math.max(...listed.map((match) => match.number)) + 1 : 1;
		const suffix = number > 1 ? `-${number}` : '';
		const tiebreaker = number > 1 ? ' Tiebreaker' : '';
		const match = projected(
			row.match,
			number,
			`${SECTION[row.bracket]} Bracket Round ${row.round} Match ${row.match}${tiebreaker}`,
			`M${row.match}${suffix}`,
			expected.red === null ? [] : lineup(bySeed.get(expected.red)!),
			expected.blue === null ? [] : lineup(bySeed.get(expected.blue)!)
		);
		filled.push(match);
		const gaps: Partial<Record<AllianceColor, string>> = {};
		if (expected.red === null) gaps.red = describe(row.red);
		if (expected.blue === null) gaps.blue = describe(row.blue);
		if (gaps.red || gaps.blue) pending.set(match.key, gaps);
	}
	return { matches: filled.sort(byOrder), pending };
}
