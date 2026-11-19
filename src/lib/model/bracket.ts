import { mulberry32 } from './stats.ts';

export type AllianceCount = 2 | 4 | 6 | 8;

export type Source = { seed: number } | { winnerOf: number } | { loserOf: number };

export type BracketMatch = {
	match: number;
	round: number;
	bracket: 'upper' | 'lower' | 'final';
	red: Source;
	blue: Source;
	ifNeeded: boolean;
	loserPlace: string | null;
};

export type Color = 'red' | 'blue';

export type ResolvedMatch = BracketMatch & {
	redAlliance: number | null;
	blueAlliance: number | null;
	winner: Color | null;
	needed: boolean | null;
};

export type BracketState = {
	size: AllianceCount;
	matches: ResolvedMatch[];
	champion: number | null;
	finalist: number | null;
	done: boolean;
};

type Row = [number, number, 'upper' | 'lower' | 'final', string, string, string | null];

const s = (code: string): Source => {
	const n = Number(code.slice(1));
	if (code[0] === 'A') return { seed: n };
	if (code[0] === 'W') return { winnerOf: n };
	return { loserOf: n };
};

const TABLES: Record<AllianceCount, Row[]> = {
	2: [
		[1, 1, 'final', 'A1', 'A2', null],
		[2, 1, 'final', 'A1', 'A2', null],
		[3, 1, 'final', 'A1', 'A2', null]
	],
	4: [
		[1, 1, 'upper', 'A1', 'A4', null],
		[2, 1, 'upper', 'A2', 'A3', null],
		[3, 2, 'lower', 'L1', 'L2', '4th'],
		[4, 2, 'upper', 'W1', 'W2', null],
		[5, 3, 'lower', 'L4', 'W3', '3rd'],
		[6, 4, 'final', 'W4', 'W5', null],
		[7, 4, 'final', 'W4', 'W5', null]
	],
	6: [
		[1, 1, 'upper', 'A4', 'A5', null],
		[2, 1, 'upper', 'A3', 'A6', null],
		[3, 2, 'upper', 'A1', 'W1', null],
		[4, 2, 'upper', 'A2', 'W2', null],
		[5, 3, 'lower', 'L3', 'L2', 'tied 5th'],
		[6, 3, 'lower', 'L4', 'L1', 'tied 5th'],
		[7, 4, 'upper', 'W3', 'W4', null],
		[8, 4, 'lower', 'W6', 'W5', '4th'],
		[9, 5, 'lower', 'L7', 'W8', '3rd'],
		[10, 6, 'final', 'W7', 'W9', null],
		[11, 6, 'final', 'W7', 'W9', null]
	],
	8: [
		[1, 1, 'upper', 'A1', 'A8', null],
		[2, 1, 'upper', 'A4', 'A5', null],
		[3, 1, 'upper', 'A2', 'A7', null],
		[4, 1, 'upper', 'A3', 'A6', null],
		[5, 2, 'lower', 'L1', 'L2', 'tied 7th'],
		[6, 2, 'lower', 'L3', 'L4', 'tied 7th'],
		[7, 2, 'upper', 'W1', 'W2', null],
		[8, 2, 'upper', 'W3', 'W4', null],
		[9, 3, 'lower', 'L7', 'W6', 'tied 5th'],
		[10, 3, 'lower', 'L8', 'W5', 'tied 5th'],
		[11, 4, 'upper', 'W7', 'W8', null],
		[12, 4, 'lower', 'W10', 'W9', '4th'],
		[13, 5, 'lower', 'L11', 'W12', '3rd'],
		[14, 6, 'final', 'W11', 'W13', null],
		[15, 6, 'final', 'W11', 'W13', null]
	]
};

const BRACKETS = Object.fromEntries(
	Object.entries(TABLES).map(([size, rows]) => {
		const last = rows[rows.length - 1][0];
		return [
			size,
			rows.map(([match, round, bracket, red, blue, loserPlace]) => ({
				match,
				round,
				bracket,
				red: s(red),
				blue: s(blue),
				ifNeeded: match === last,
				loserPlace
			}))
		];
	})
) as Record<AllianceCount, BracketMatch[]>;

export function bracketFor(alliances: AllianceCount): BracketMatch[] {
	return BRACKETS[alliances];
}

export function allianceCountFor(teams: number): AllianceCount | 0 {
	if (teams < 4) return 0;
	if (teams <= 10) return 2;
	if (teams <= 20) return 4;
	if (teams <= 40) return 6;
	return 8;
}

export function upperFinal(size: AllianceCount): number {
	return { 2: 1, 4: 4, 6: 7, 8: 11 }[size];
}

export function finalsStart(size: AllianceCount): number {
	return { 2: 1, 4: 6, 6: 10, 8: 14 }[size];
}

export type Results = Map<number, Color> | Record<number, Color>;

function lookup(results: Results, match: number): Color | undefined {
	return results instanceof Map ? results.get(match) : results[match];
}

type Decide = (match: BracketMatch, red: number, blue: number) => Color | null;

type Walk = {
	matches: ResolvedMatch[];
	champion: number | null;
	finalist: number | null;
};

function walk(size: AllianceCount, decide: Decide): Walk {
	const table = bracketFor(size);
	const winners: (number | null)[] = new Array(table.length + 1).fill(null);
	const losers: (number | null)[] = new Array(table.length + 1).fill(null);
	const allianceOf = (src: Source): number | null => {
		if ('seed' in src) return src.seed;
		if ('winnerOf' in src) return winners[src.winnerOf];
		return losers[src.loserOf];
	};
	const first = finalsStart(size);
	const finalWins = new Map<number, number>();
	const matches: ResolvedMatch[] = [];
	let champion: number | null = null;
	let finalist: number | null = null;
	for (const m of table) {
		const red = allianceOf(m.red);
		const blue = allianceOf(m.blue);
		let needed: boolean | null = true;
		if (m.bracket === 'final' && m.match > first) {
			const earlier = matches.filter((x) => x.bracket === 'final');
			if (champion !== null) needed = false;
			else if (earlier.some((x) => x.winner === null)) needed = null;
		}
		const winner = needed === false || red === null || blue === null ? null : decide(m, red, blue);
		matches.push({ ...m, redAlliance: red, blueAlliance: blue, winner, needed });
		if (winner === null || red === null || blue === null) continue;
		const w = winner === 'red' ? red : blue;
		const l = winner === 'red' ? blue : red;
		winners[m.match] = w;
		losers[m.match] = l;
		if (m.bracket !== 'final') continue;
		finalWins.set(w, (finalWins.get(w) ?? 0) + 1);
		const decided = size === 2 ? (finalWins.get(w) ?? 0) >= 2 : m.match > first || w === red;
		if (decided) {
			champion = w;
			finalist = l;
		}
	}
	return { matches, champion, finalist };
}

export function resolveBracket(size: AllianceCount, results: Results): BracketState {
	const out = walk(size, (m) => lookup(results, m.match) ?? null);
	return { size, ...out, done: out.champion !== null };
}

export type WinProb = (red: number, blue: number) => number;

export type BracketOdds = {
	alliance: number;
	champion: number;
	finalist: number;
	upperFinal: number;
	firstMatchWin: number;
	reachRound: number[];
};

export function simulateBracket(
	size: AllianceCount,
	winProb: WinProb,
	results: Results = new Map(),
	sims = 10000,
	seed = 1
): BracketOdds[] {
	const rng = mulberry32(seed);
	const rounds = Math.max(...bracketFor(size).map((m) => m.round));
	const champion = new Float64Array(size + 1);
	const finalist = new Float64Array(size + 1);
	const upper = new Float64Array(size + 1);
	const firstWin = new Float64Array(size + 1);
	const reach = Array.from({ length: size + 1 }, () => new Float64Array(rounds + 1));
	const uf = upperFinal(size);
	const cache = new Map<number, number>();
	const p = (red: number, blue: number) => {
		const key = red * 16 + blue;
		let v = cache.get(key);
		if (v === undefined) {
			v = winProb(red, blue);
			cache.set(key, v);
		}
		return v;
	};
	const decide: Decide = (m, red, blue) =>
		lookup(results, m.match) ?? (rng() < p(red, blue) ? 'red' : 'blue');
	for (let i = 0; i < sims; i++) {
		const out = walk(size, decide);
		const seen = new Set<number>();
		const roundSeen = new Set<number>();
		for (const m of out.matches) {
			if (m.redAlliance === null || m.blueAlliance === null || m.winner === null) continue;
			const w = m.winner === 'red' ? m.redAlliance : m.blueAlliance;
			for (const a of [m.redAlliance, m.blueAlliance]) {
				if (!roundSeen.has(a * 100 + m.round)) {
					roundSeen.add(a * 100 + m.round);
					reach[a][m.round]++;
				}
				if (m.match === uf) upper[a]++;
				if (!seen.has(a)) {
					seen.add(a);
					if (a === w) firstWin[a]++;
				}
			}
		}
		if (out.champion !== null) champion[out.champion]++;
		if (out.finalist !== null) finalist[out.finalist]++;
	}
	return Array.from({ length: size }, (_, k) => {
		const a = k + 1;
		return {
			alliance: a,
			champion: champion[a] / sims,
			finalist: finalist[a] / sims,
			upperFinal: upper[a] / sims,
			firstMatchWin: firstWin[a] / sims,
			reachRound: Array.from(reach[a].slice(1), (x) => x / sims)
		};
	});
}

export type PickInput = {
	alliances: AllianceCount;
	ranking: number[];
	formed: number[][];
	declined?: number[];
	strength: (team: number) => number;
	winProb: (red: number[], blue: number[]) => number;
};

export type PickOption = {
	team: number;
	promotes: boolean;
	alliances: number[][];
	firstMatchWin: number;
	upperFinal: number;
	champion: number;
};

export function fillAlliances(input: PickInput, pick: number): number[][] {
	const taken = new Set(input.formed.flat());
	const declined = new Set(input.declined ?? []);
	const pool = input.ranking.filter((t) => !taken.has(t));
	const captain = pool.shift();
	if (captain === undefined) return input.formed.map((a) => [...a]);
	const out = [...input.formed.map((a) => [...a]), [captain, pick]];
	const remaining = pool.filter((t) => t !== pick);
	while (out.length < input.alliances && remaining.length) {
		const lead = remaining.shift()!;
		let best = -1;
		for (let i = 0; i < remaining.length; i++) {
			if (declined.has(remaining[i])) continue;
			if (best < 0 || input.strength(remaining[i]) > input.strength(remaining[best])) best = i;
		}
		out.push(best < 0 ? [lead] : [lead, ...remaining.splice(best, 1)]);
	}
	return out;
}

export function analyzePicks(
	input: PickInput,
	options: { sims?: number; seed?: number } = {}
): PickOption[] {
	const taken = new Set(input.formed.flat());
	const declined = new Set(input.declined ?? []);
	const pool = input.ranking.filter((t) => !taken.has(t));
	const onClock = input.formed.length + 1;
	const futureCaptains = new Set(pool.slice(1, 1 + input.alliances - onClock));
	const candidates = pool.slice(1).filter((t) => !declined.has(t));
	return candidates
		.map((team) => {
			const alliances = fillAlliances(input, team);
			const odds = simulateBracket(
				input.alliances,
				(red, blue) => input.winProb(alliances[red - 1] ?? [], alliances[blue - 1] ?? []),
				new Map(),
				options.sims ?? 2000,
				options.seed ?? 1
			)[onClock - 1];
			return {
				team,
				promotes: futureCaptains.has(team),
				alliances,
				firstMatchWin: odds.firstMatchWin,
				upperFinal: odds.upperFinal,
				champion: odds.champion
			};
		})
		.sort((a, b) => b.champion - a.champion || b.upperFinal - a.upperFinal || a.team - b.team);
}
