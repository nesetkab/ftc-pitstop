import type { BracketMatchView, BracketView } from './bracket.ts';

export const SIZES = {
	box: 200,
	wideBox: 252,
	head: 26,
	row: 34,
	finalsHead: 26,
	notesHead: 42,
	game: 56,
	gapX: 32,
	gapY: 16,
	title: 30,
	label: 24,
	sectionGap: 28
};

export type PlacedMatch = { match: BracketMatchView; x: number; y: number };

export type PlacedRound = { round: number; x: number; y: number; matches: PlacedMatch[] };

export type PlacedSection = {
	id: 'upper' | 'lower';
	title: string;
	y: number;
	rounds: PlacedRound[];
};

export type Line = { d: string; done: boolean };

export type BracketLayout = {
	width: number;
	height: number;
	box: number;
	boxHeight: number;
	sections: PlacedSection[];
	finals: { x: number; y: number; width: number; head: number; titleY: number };
	lines: Line[];
};

type Point = { x: number; y: number; played: boolean };

function slotOffset(side: 'red' | 'blue', head: number): number {
	return head + (side === 'red' ? SIZES.row / 2 : SIZES.row * 1.5);
}

function divider(y: number): number {
	return y + SIZES.head + SIZES.row;
}

function elbow(fromX: number, fromY: number, toX: number, toY: number): string {
	const middle = toX - SIZES.gapX / 2;
	if (fromY === toY) return `M${fromX} ${fromY}H${toX}`;
	return `M${fromX} ${fromY}H${middle}V${toY}H${toX}`;
}

export function layoutBracket(bracket: BracketView): BracketLayout {
	const wide = [...bracket.upper.flat(), ...bracket.lower.flat()].some(
		(match) => match.red.teams.length > 2 || match.blue.teams.length > 2
	);
	const finalsWide = bracket.finals.alliances.some((side) => side.teams.length > 2);
	const box = wide || finalsWide ? SIZES.wideBox : SIZES.box;
	const boxHeight = SIZES.head + SIZES.row * 2;
	const step = box + SIZES.gapX;
	const placed = new Map<number, Point>();
	const lines: Line[] = [];
	const sections: PlacedSection[] = [];
	let top = 0;
	let columns = 0;

	for (const [id, title, rounds] of [
		['upper', 'Upper bracket', bracket.upper],
		['lower', 'Lower bracket', bracket.lower]
	] as const) {
		if (rounds.length === 0) continue;
		columns = Math.max(columns, rounds.length);
		const local = new Map<number, number>();
		let cursor = 0;
		for (const round of rounds) {
			for (const match of round) {
				const feeders = (['red', 'blue'] as const)
					.map((side) => ({ side, from: match[side].winnerOf }))
					.filter((entry) => entry.from !== null && local.has(entry.from));
				if (feeders.length === 0) {
					local.set(match.series, cursor);
					cursor += boxHeight + SIZES.gapY;
				} else if (feeders.length === 1) {
					const feeder = local.get(feeders[0].from as number) as number;
					local.set(match.series, divider(feeder) - slotOffset(feeders[0].side, SIZES.head));
				} else {
					const middle =
						feeders.reduce((sum, entry) => sum + divider(local.get(entry.from as number)!), 0) /
						feeders.length;
					local.set(match.series, middle - SIZES.head - SIZES.row);
				}
			}
		}
		const lowest = Math.min(...local.values());
		const start = top + SIZES.title + SIZES.label - lowest;
		const placedRounds: PlacedRound[] = rounds.map((round, column) => ({
			round: round[0].round,
			x: column * step,
			y: top + SIZES.title,
			matches: round.map((match) => {
				const point = { x: column * step, y: local.get(match.series)! + start };
				placed.set(match.series, { ...point, played: match.played });
				return { match, ...point };
			})
		}));
		sections.push({ id, title, y: top, rounds: placedRounds });
		const bottom = Math.max(...[...local.values()].map((y) => y + start + boxHeight));
		top = bottom + SIZES.sectionGap;
	}

	for (const section of sections) {
		for (const round of section.rounds) {
			for (const { match, x, y } of round.matches) {
				for (const side of ['red', 'blue'] as const) {
					const from = placed.get(match[side].winnerOf ?? -1);
					if (!from) continue;
					lines.push({
						d: elbow(from.x + box, divider(from.y), x, y + slotOffset(side, SIZES.head)),
						done: from.played
					});
				}
			}
		}
	}

	const { games, alliances } = bracket.finals;
	const head = games.some((game) => game.ifNeeded || (!game.played && game.time !== null))
		? SIZES.notesHead
		: SIZES.finalsHead;
	const finalsWidth = box + (games.length - 1) * SIZES.game;
	const finalsX = columns * step;
	const feeders = alliances.map((side) => placed.get(side.winnerOf ?? -1));
	let finalsY: number;
	if (feeders.every((point) => point !== undefined)) {
		const middle = (divider(feeders[0]!.y) + divider(feeders[1]!.y)) / 2;
		finalsY = middle - head - SIZES.row;
	} else {
		finalsY = SIZES.title;
	}
	alliances.forEach((side, index) => {
		const from = feeders[index];
		if (!from) return;
		lines.push({
			d: elbow(
				from.x + box,
				divider(from.y),
				finalsX,
				finalsY + slotOffset(index === 0 ? 'red' : 'blue', head)
			),
			done: from.played
		});
	});

	const finalsBottom = finalsY + head + SIZES.row * 2;
	const sectionsBottom = sections.length > 0 ? top - SIZES.sectionGap : 0;
	return {
		width: finalsX + finalsWidth,
		height: Math.ceil(Math.max(finalsBottom, sectionsBottom)) + 2,
		box,
		boxHeight,
		sections,
		finals: { x: finalsX, y: finalsY, width: finalsWidth, head, titleY: finalsY - SIZES.title },
		lines
	};
}
