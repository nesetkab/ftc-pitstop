import { describe, expect, it } from 'vitest';
import type { AllianceSelection } from '#lib/types.ts';
import { SIZES, layoutBracket, type BracketLayout } from './bracket-layout.ts';
import { buildBracket, type BracketView } from './bracket.ts';
import { fixtureBundle } from './test-fixtures.ts';

function fixture(code: string) {
	const bundle = fixtureBundle(code);
	return buildBracket(bundle.alliances, bundle.matches) as BracketView;
}

function empty(count: number) {
	const alliances: AllianceSelection[] = Array.from({ length: count }, (_, index) => ({
		seed: index + 1,
		name: `Alliance ${index + 1}`,
		captain: 100 + index * 2,
		picks: [101 + index * 2],
		backup: null,
		backupReplaced: null
	}));
	return buildBracket(alliances, []) as BracketView;
}

function boxes(layout: BracketLayout) {
	return layout.sections.flatMap((section) =>
		section.rounds.flatMap((round) => round.matches.map((placed) => placed))
	);
}

function at(layout: BracketLayout, series: number) {
	return boxes(layout).find((placed) => placed.match.series === series)!;
}

function overlaps(layout: BracketLayout) {
	const all = boxes(layout);
	return all.some((a, i) =>
		all.some(
			(b, j) =>
				i < j &&
				a.x === b.x &&
				a.y < b.y + layout.boxHeight + SIZES.gapY / 2 &&
				b.y < a.y + layout.boxHeight + SIZES.gapY / 2
		)
	);
}

describe('layoutBracket', () => {
	it('places a 6 alliance bracket as a tree with the finals at the end', () => {
		const layout = layoutBracket(fixture('USMTBUQ-final'));
		const upper = layout.sections[0];
		const lower = layout.sections[1];
		expect(upper.rounds.map((round) => round.round)).toEqual([1, 2, 4]);
		expect(lower.rounds.map((round) => round.round)).toEqual([3, 4, 5]);
		const m7 = at(layout, 7);
		const m3 = at(layout, 3);
		const m4 = at(layout, 4);
		expect(m7.y + layout.boxHeight / 2).toBeGreaterThan(m3.y + layout.boxHeight / 2);
		expect(m7.y + layout.boxHeight / 2).toBeLessThan(m4.y + layout.boxHeight / 2);
		expect(at(layout, 9).y).toBeGreaterThan(m4.y + layout.boxHeight);
		expect(layout.finals.x).toBe(3 * (layout.box + SIZES.gapX));
		expect(layout.finals.y).toBeGreaterThan(m7.y);
		expect(layout.finals.y).toBeLessThan(at(layout, 9).y);
		expect(overlaps(layout)).toBe(false);
	});

	it('draws straight lines into a match fed by one winner', () => {
		const layout = layoutBracket(fixture('USMTBUQ-final'));
		const m1 = at(layout, 1);
		const straight = `M${m1.x + layout.box} ${m1.y + SIZES.head + SIZES.row}H${at(layout, 3).x}`;
		expect(layout.lines.map((line) => line.d)).toContain(straight);
	});

	it('joins each winner to the next match and both brackets to the finals', () => {
		const layout = layoutBracket(fixture('USMTBUQ-final'));
		expect(layout.lines).toHaveLength(9);
		expect(layout.lines.every((line) => line.done)).toBe(true);
		const ends = layout.lines.map((line) => Number(line.d.split('H').at(-1)));
		expect(ends.filter((x) => x === layout.finals.x)).toHaveLength(2);
	});

	it('marks lines from matches still to play', () => {
		const layout = layoutBracket(empty(6));
		expect(layout.lines.some((line) => line.done)).toBe(false);
	});

	it('fits an 8 alliance bracket without overlaps', () => {
		const layout = layoutBracket(empty(8));
		expect(layout.sections.map((section) => section.rounds.length)).toEqual([3, 4]);
		expect(layout.finals.x).toBe(4 * (layout.box + SIZES.gapX));
		expect(overlaps(layout)).toBe(false);
		expect(layout.lines).toHaveLength(13);
	});

	it('fits a 4 alliance bracket', () => {
		const layout = layoutBracket(fixture('UZTAQ1'));
		expect(layout.sections.map((section) => section.rounds.length)).toEqual([2, 2]);
		expect(overlaps(layout)).toBe(false);
	});

	it('shows only the finals for 2 alliances', () => {
		const layout = layoutBracket(fixture('USALATQ'));
		expect(layout.sections).toEqual([]);
		expect(layout.lines).toEqual([]);
		expect(layout.finals.x).toBe(0);
		expect(layout.finals.titleY).toBe(0);
	});

	it('widens boxes for alliances of three', () => {
		const alliances: AllianceSelection[] = [1, 2, 3, 4].map((seed) => ({
			seed,
			name: `Alliance ${seed}`,
			captain: seed * 10,
			picks: [seed * 10 + 1, seed * 10 + 2],
			backup: null,
			backupReplaced: null
		}));
		const layout = layoutBracket(buildBracket(alliances, []) as BracketView);
		expect(layout.box).toBe(SIZES.wideBox);
	});
});
