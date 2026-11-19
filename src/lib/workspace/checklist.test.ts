import { describe, expect, it } from 'vitest';
import {
	addItem,
	addItems,
	moveItem,
	nextMatchLabel,
	progress,
	removeItem,
	renameItem,
	resetForNextMatch,
	setMatch,
	toggleItem
} from '#lib/workspace/checklist.ts';
import type { Checklist } from '#lib/workspace/schemas.ts';

const NOW = 1_700_000_000_000;

function list(...texts: string[]): Checklist {
	return {
		match: 'Q26',
		items: texts.map((text, index) => ({ id: `i${index + 1}`, text, by: null, at: null })),
		history: []
	};
}

describe('checking items', () => {
	it('stores who checked an item and when', () => {
		const next = toggleItem(list('Battery in', 'Pollen loaded'), 'i1', 'AL', NOW);
		expect(next.items[0]).toMatchObject({ by: 'AL', at: NOW });
		expect(next.items[1]).toMatchObject({ by: null, at: null });
	});

	it('unchecks an item that was checked', () => {
		const checked = toggleItem(list('Battery in'), 'i1', 'AL', NOW);
		const next = toggleItem(checked, 'i1', 'JR', NOW + 1);
		expect(next.items[0]).toMatchObject({ by: null, at: null });
	});

	it('counts progress', () => {
		let next = list('A', 'B', 'C');
		next = toggleItem(next, 'i1', 'AL', NOW);
		next = toggleItem(next, 'i3', 'AL', NOW);
		expect(progress(next)).toEqual({ done: 2, total: 3 });
		expect(progress(list())).toEqual({ done: 0, total: 0 });
	});
});

describe('editing items', () => {
	it('adds trimmed items once per id', () => {
		const next = addItem(list('A'), 'x', '  New step  ');
		expect(next.items.map((item) => item.text)).toEqual(['A', 'New step']);
		expect(addItem(next, 'x', 'Again')).toBe(next);
		expect(addItem(next, 'y', '   ')).toBe(next);
	});

	it('adds several items and keeps their order', () => {
		const next = addItems(list(), [
			{ id: 'a', text: 'One' },
			{ id: 'b', text: 'Two' }
		]);
		expect(next.items.map((item) => item.text)).toEqual(['One', 'Two']);
	});

	it('renames, removes and reorders', () => {
		let next = list('A', 'B', 'C');
		next = renameItem(next, 'i2', 'Bee');
		expect(next.items[1].text).toBe('Bee');
		next = removeItem(next, 'i1');
		expect(next.items.map((item) => item.id)).toEqual(['i2', 'i3']);
		next = moveItem(next, 'i3', 0);
		expect(next.items.map((item) => item.id)).toEqual(['i3', 'i2']);
		expect(moveItem(next, 'zzz', 0)).toBe(next);
	});

	it('sets the match label', () => {
		expect(setMatch(list(), '  Q30 ').match).toBe('Q30');
		expect(setMatch(list(), 'x'.repeat(40)).match).toHaveLength(16);
	});
});

describe('next match', () => {
	it('adds one to the number at the end of a label', () => {
		expect(nextMatchLabel('Q26')).toBe('Q27');
		expect(nextMatchLabel('M3')).toBe('M4');
		expect(nextMatchLabel('M3-2')).toBe('M3-3');
		expect(nextMatchLabel('Q9')).toBe('Q10');
		expect(nextMatchLabel('Final')).toBe('Final');
		expect(nextMatchLabel('')).toBe('');
	});

	it('clears the checks, advances the match and keeps a record', () => {
		let next = list('A', 'B', 'C');
		next = toggleItem(next, 'i1', 'AL', NOW);
		next = toggleItem(next, 'i2', 'JR', NOW);
		next = toggleItem(next, 'i3', 'AL', NOW);
		const reset = resetForNextMatch(next, NOW + 1000);
		expect(reset.match).toBe('Q27');
		expect(reset.items.every((item) => item.at === null && item.by === null)).toBe(true);
		expect(reset.items.map((item) => item.text)).toEqual(['A', 'B', 'C']);
		expect(reset.history).toEqual([
			{ match: 'Q26', at: NOW + 1000, done: 3, total: 3, by: ['AL', 'JR'] }
		]);
	});

	it('keeps no record when nothing was checked', () => {
		const reset = resetForNextMatch(list('A', 'B'), NOW);
		expect(reset.history).toEqual([]);
		expect(reset.match).toBe('Q27');
	});

	it('keeps the newest records first and caps them', () => {
		let next = list('A');
		for (let i = 0; i < 40; i++) {
			next = toggleItem(next, 'i1', 'AL', NOW + i);
			next = resetForNextMatch(next, NOW + i);
		}
		expect(next.history).toHaveLength(30);
		expect(next.history[0].match).toBe('Q65');
	});
});
