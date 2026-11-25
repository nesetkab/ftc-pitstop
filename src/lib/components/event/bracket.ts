import type { AllianceColor, AllianceSelection, Match } from '#lib/types.ts';
import { isFinalsOnly, teamNumbers } from './matches.ts';

export type BracketSize = 2 | 4 | 6 | 8;

export type Section = 'upper' | 'lower' | 'final';

type Source = { seed: number } | { winnerOf: number } | { loserOf: number };

type Row = [series: number, round: number, section: Section, red: string, blue: string];

const TABLES: Record<4 | 6 | 8, Row[]> = {
	4: [
		[1, 1, 'upper', 'A1', 'A4'],
		[2, 1, 'upper', 'A2', 'A3'],
		[3, 2, 'lower', 'L1', 'L2'],
		[4, 2, 'upper', 'W1', 'W2'],
		[5, 3, 'lower', 'L4', 'W3'],
		[6, 4, 'final', 'W4', 'W5'],
		[7, 5, 'final', 'W4', 'W5']
	],
	6: [
		[1, 1, 'upper', 'A4', 'A5'],
		[2, 1, 'upper', 'A3', 'A6'],
		[3, 2, 'upper', 'A1', 'W1'],
		[4, 2, 'upper', 'A2', 'W2'],
		[5, 3, 'lower', 'L3', 'L2'],
		[6, 3, 'lower', 'L4', 'L1'],
		[7, 4, 'upper', 'W3', 'W4'],
		[8, 4, 'lower', 'W6', 'W5'],
		[9, 5, 'lower', 'L7', 'W8'],
		[10, 6, 'final', 'W7', 'W9'],
		[11, 7, 'final', 'W7', 'W9']
	],
	8: [
		[1, 1, 'upper', 'A1', 'A8'],
		[2, 1, 'upper', 'A4', 'A5'],
		[3, 1, 'upper', 'A2', 'A7'],
		[4, 1, 'upper', 'A3', 'A6'],
		[5, 2, 'lower', 'L1', 'L2'],
		[6, 2, 'lower', 'L3', 'L4'],
		[7, 2, 'upper', 'W1', 'W2'],
		[8, 2, 'upper', 'W3', 'W4'],
		[9, 3, 'lower', 'L7', 'W6'],
		[10, 3, 'lower', 'L8', 'W5'],
		[11, 4, 'upper', 'W7', 'W8'],
		[12, 4, 'lower', 'W10', 'W9'],
		[13, 5, 'lower', 'L11', 'W12'],
		[14, 6, 'final', 'W11', 'W13'],
		[15, 7, 'final', 'W11', 'W13']
	]
};

function source(code: string): Source {
	const number = Number(code.slice(1));
	if (code[0] === 'A') return { seed: number };
	if (code[0] === 'W') return { winnerOf: number };
	return { loserOf: number };
}

function winnerOf(from: Source): number | null {
	return 'winnerOf' in from ? from.winnerOf : null;
}

function describe(from: Source): string {
	if ('seed' in from) return `Alliance ${from.seed}`;
	if ('winnerOf' in from) return `Winner of M${from.winnerOf}`;
	return `Loser of M${from.loserOf}`;
}

export type SlotView = {
	seed: number | null;
	teams: number[];
	source: string;
	score: number | null;
	won: boolean;
	winnerOf: number | null;
};

export type BracketMatchView = {
	series: number;
	label: string;
	key: string | null;
	section: Section;
	round: number;
	red: SlotView;
	blue: SlotView;
	played: boolean;
	winner: AllianceColor | null;
	time: number | null;
};

export type FinalsAlliance = {
	seed: number | null;
	teams: number[];
	source: string;
	wins: number;
	champion: boolean;
	winnerOf: number | null;
};

export type FinalsGame = {
	label: string;
	key: string | null;
	scores: [number | null, number | null];
	winner: 0 | 1 | null;
	played: boolean;
	ifNeeded: boolean;
	time: number | null;
};

export type FinalsView = {
	alliances: [FinalsAlliance, FinalsAlliance];
	games: FinalsGame[];
};

export type BracketView = {
	size: BracketSize;
	upper: BracketMatchView[][];
	lower: BracketMatchView[][];
	finals: FinalsView;
	champion: number | null;
};

export function seedIndex(alliances: AllianceSelection[]): Map<number, number> {
	const index = new Map<number, number>();
	for (const alliance of alliances) {
		for (const team of [alliance.captain, ...alliance.picks, alliance.backup]) {
			if (team) index.set(team, alliance.seed);
		}
	}
	return index;
}

function seedOf(teams: number[], index: Map<number, number>): number | null {
	for (const team of teams) {
		const seed = index.get(team);
		if (seed !== undefined) return seed;
	}
	return null;
}

export function bracketSize(alliances: AllianceSelection[], matches: Match[]): BracketSize | null {
	const playoffs = matches.filter((match) => match.level === 'playoff');
	if (playoffs.length > 0 && playoffs.every(isFinalsOnly)) return 2;
	const count = alliances.length;
	if (count === 2 || count === 4 || count === 6 || count === 8) return count;
	if (playoffs.length === 0) return null;
	const top = Math.max(...playoffs.map((match) => match.series));
	if (top <= 1) return 2;
	if (top <= 7) return 4;
	if (top <= 11) return 6;
	return 8;
}

function latestGame(games: Match[]): Match {
	const played = games.filter((game) => game.result);
	const pool = played.length > 0 ? played : games;
	return pool.reduce((best, game) => (game.number > best.number ? game : best));
}

function membersOf(seed: number | null, alliances: AllianceSelection[]): number[] {
	const alliance = alliances.find((entry) => entry.seed === seed);
	return alliance ? [alliance.captain, ...alliance.picks] : [];
}

function finalsOnly(alliances: AllianceSelection[], matches: Match[], index: Map<number, number>) {
	const games = matches
		.filter((match) => match.level === 'playoff')
		.sort((a, b) => a.number - b.number);
	const first = games[0];
	const top =
		(first ? seedOf(teamNumbers(first, 'red'), index) : null) ??
		alliances.find((alliance) => alliance.seed === 1)?.seed ??
		1;
	const bottom =
		(first ? seedOf(teamNumbers(first, 'blue'), index) : null) ??
		alliances.find((alliance) => alliance.seed === 2)?.seed ??
		2;
	const sides: [FinalsAlliance, FinalsAlliance] = [
		{
			seed: top,
			teams: first ? teamNumbers(first, 'red') : membersOf(top, alliances),
			source: `Alliance ${top}`,
			wins: 0,
			champion: false,
			winnerOf: null
		},
		{
			seed: bottom,
			teams: first ? teamNumbers(first, 'blue') : membersOf(bottom, alliances),
			source: `Alliance ${bottom}`,
			wins: 0,
			champion: false,
			winnerOf: null
		}
	];
	const views: FinalsGame[] = games.map((game) => {
		const redSeed = seedOf(teamNumbers(game, 'red'), index);
		const flipped = redSeed !== null && redSeed === bottom;
		const result = game.result;
		const scores: [number | null, number | null] = result
			? flipped
				? [result.blue.total, result.red.total]
				: [result.red.total, result.blue.total]
			: [null, null];
		let winner: 0 | 1 | null = null;
		if (result?.winner) winner = (result.winner === 'red') !== flipped ? 0 : 1;
		if (winner !== null) sides[winner].wins += 1;
		return {
			label: game.label,
			key: game.key,
			scores,
			winner,
			played: result !== null,
			ifNeeded: false,
			time: game.scheduledTime
		};
	});
	const decided = sides.findIndex((side) => side.wins >= 2);
	if (decided >= 0) sides[decided].champion = true;
	for (let number = views.length + 1; decided < 0 && number <= 3; number++) {
		views.push({
			label: `F${number}`,
			key: null,
			scores: [null, null],
			winner: null,
			played: false,
			ifNeeded: number === 3 && sides[0].wins + sides[1].wins < 2,
			time: null
		});
	}
	return { sides, views, champion: decided >= 0 ? sides[decided].seed : null };
}

export function buildBracket(alliances: AllianceSelection[], matches: Match[]): BracketView | null {
	const size = bracketSize(alliances, matches);
	if (size === null) return null;
	const index = seedIndex(alliances);

	if (size === 2) {
		const { sides, views, champion } = finalsOnly(alliances, matches, index);
		return { size, upper: [], lower: [], finals: { alliances: sides, games: views }, champion };
	}

	const bySeries = new Map<number, Match[]>();
	for (const match of matches) {
		if (match.level !== 'playoff') continue;
		bySeries.set(match.series, [...(bySeries.get(match.series) ?? []), match]);
	}

	const winners = new Map<number, number | null>();
	const losers = new Map<number, number | null>();
	const resolve = (from: Source): number | null => {
		if ('seed' in from) return from.seed;
		if ('winnerOf' in from) return winners.get(from.winnerOf) ?? null;
		return losers.get(from.loserOf) ?? null;
	};

	const views: BracketMatchView[] = TABLES[size].map(
		([series, round, section, redCode, blueCode]) => {
			const games = bySeries.get(series);
			const game = games ? latestGame(games) : null;
			const redFrom = source(redCode);
			const blueFrom = source(blueCode);
			const redTeams = game ? teamNumbers(game, 'red') : [];
			const blueTeams = game ? teamNumbers(game, 'blue') : [];
			const redSeed = (game ? seedOf(redTeams, index) : null) ?? resolve(redFrom);
			const blueSeed = (game ? seedOf(blueTeams, index) : null) ?? resolve(blueFrom);
			const result = game?.result ?? null;
			const winner = result?.winner ?? null;
			winners.set(series, winner === 'red' ? redSeed : winner === 'blue' ? blueSeed : null);
			losers.set(series, winner === 'red' ? blueSeed : winner === 'blue' ? redSeed : null);
			return {
				series,
				label: game?.label ?? `M${series}`,
				key: game?.key ?? null,
				section,
				round,
				red: {
					seed: redSeed,
					teams: redTeams.length > 0 ? redTeams : membersOf(redSeed, alliances),
					source: describe(redFrom),
					score: result ? result.red.total : null,
					won: winner === 'red',
					winnerOf: winnerOf(redFrom)
				},
				blue: {
					seed: blueSeed,
					teams: blueTeams.length > 0 ? blueTeams : membersOf(blueSeed, alliances),
					source: describe(blueFrom),
					score: result ? result.blue.total : null,
					won: winner === 'blue',
					winnerOf: winnerOf(blueFrom)
				},
				played: result !== null,
				winner,
				time: game?.scheduledTime ?? null
			};
		}
	);

	const columns = (section: Section) => {
		const rounds = [
			...new Set(views.filter((view) => view.section === section).map((view) => view.round))
		].sort((a, b) => a - b);
		return rounds.map((round) =>
			views.filter((view) => view.section === section && view.round === round)
		);
	};

	const finalGames = views.filter((view) => view.section === 'final');
	const [first, second] = finalGames;
	const top = first.red.seed;
	const bottom = first.blue.seed;
	const sides: [FinalsAlliance, FinalsAlliance] = [
		{
			seed: top,
			teams: first.red.teams,
			source: first.red.source,
			wins: 0,
			champion: false,
			winnerOf: first.red.winnerOf
		},
		{
			seed: bottom,
			teams: first.blue.teams,
			source: first.blue.source,
			wins: 0,
			champion: false,
			winnerOf: first.blue.winnerOf
		}
	];
	const toGame = (view: BracketMatchView, ifNeeded: boolean): FinalsGame => {
		const flipped = view.red.seed !== null && view.red.seed === bottom && bottom !== top;
		const scores: [number | null, number | null] = flipped
			? [view.blue.score, view.red.score]
			: [view.red.score, view.blue.score];
		let winner: 0 | 1 | null = null;
		if (view.winner) winner = (view.winner === 'red') !== flipped ? 0 : 1;
		if (winner !== null) sides[winner].wins += 1;
		return {
			label: view.label,
			key: view.key,
			scores,
			winner,
			played: view.played,
			ifNeeded,
			time: view.time
		};
	};
	const games = [toGame(first, false)];
	const firstWinner = games[0].winner;
	if (second.played || second.key || firstWinner === null) {
		games.push(toGame(second, !second.played && !second.key && firstWinner === null));
	} else if (firstWinner === 1) {
		games.push(toGame(second, false));
	}
	const deciding = games[1]?.played ? games[1] : firstWinner === 0 ? games[0] : null;
	let champion: number | null = null;
	if (deciding?.winner != null) {
		sides[deciding.winner].champion = true;
		champion = sides[deciding.winner].seed;
	}

	return {
		size,
		upper: columns('upper'),
		lower: columns('lower'),
		finals: { alliances: sides, games },
		champion
	};
}

export function playoffRecords(
	alliances: AllianceSelection[],
	matches: Match[]
): Map<number, { wins: number; losses: number; ties: number }> {
	const index = seedIndex(alliances);
	const records = new Map<number, { wins: number; losses: number; ties: number }>();
	const entry = (seed: number) => {
		let record = records.get(seed);
		if (!record) {
			record = { wins: 0, losses: 0, ties: 0 };
			records.set(seed, record);
		}
		return record;
	};
	for (const match of matches) {
		if (match.level !== 'playoff' || !match.result) continue;
		const red = seedOf(teamNumbers(match, 'red'), index);
		const blue = seedOf(teamNumbers(match, 'blue'), index);
		if (red === null || blue === null) continue;
		const winner = match.result.winner;
		if (winner === null) {
			entry(red).ties += 1;
			entry(blue).ties += 1;
		} else {
			entry(winner === 'red' ? red : blue).wins += 1;
			entry(winner === 'red' ? blue : red).losses += 1;
		}
	}
	return records;
}

function sideName(side: FinalsAlliance): string {
	return side.seed === null ? side.source : `Alliance ${side.seed}`;
}

export function finalsStatus(bracket: BracketView): string | null {
	if (bracket.champion !== null) return null;
	const { alliances, games } = bracket.finals;
	if (!games.some((game) => game.played)) return null;
	const [top, bottom] = alliances;
	if (bracket.size === 2) {
		if (top.wins === bottom.wins) return `Finals tied ${top.wins}–${bottom.wins}.`;
		const [ahead, behind] = top.wins > bottom.wins ? [top, bottom] : [bottom, top];
		return `${sideName(ahead)} leads the finals ${ahead.wins}–${behind.wins}.`;
	}
	const [first, second] = games;
	if (first.winner === 1 && second && !second.played) {
		return `${sideName(bottom)} won ${first.label}, so ${second.label} decides the event.`;
	}
	return null;
}

export function allianceStatus(bracket: BracketView, seeds: number[]): Map<number, string> {
	const status = new Map<number, string>();
	const matches = [...bracket.upper.flat(), ...bracket.lower.flat()].sort(
		(a, b) => a.series - b.series
	);
	const started =
		matches.some((match) => match.played) || bracket.finals.games.some((game) => game.played);
	if (!started) return status;
	const losses = new Map<number, number>();
	for (const match of matches) {
		if (!match.winner) continue;
		const loser = match.winner === 'red' ? match.blue.seed : match.red.seed;
		if (loser === null) continue;
		const count = (losses.get(loser) ?? 0) + 1;
		losses.set(loser, count);
		if (count === 2) status.set(loser, `Out after ${match.label}`);
	}
	for (const side of bracket.finals.alliances) {
		if (side.seed === null) continue;
		const text =
			bracket.champion === null ? 'In the finals' : side.champion ? 'Won the event' : 'Finalist';
		status.set(side.seed, text);
	}
	if (bracket.size === 2) return status;
	for (const seed of seeds) {
		if (status.has(seed)) continue;
		status.set(seed, (losses.get(seed) ?? 0) === 0 ? 'Upper bracket' : 'Lower bracket');
	}
	return status;
}
