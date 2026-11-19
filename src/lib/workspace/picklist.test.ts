import { describe, expect, it } from 'vitest';
import {
	addEntry,
	checkAdd,
	indexAtOffset,
	moveEntry,
	removeEntry,
	setEvent,
	setName,
	setNote,
	setTaken
} from '#lib/workspace/picklist.ts';
import type { PickList } from '#lib/workspace/schemas.ts';

function list(...teams: number[]): PickList {
	return {
		event: null,
		entries: teams.map((team) => ({ team, name: null, note: '', taken: false }))
	};
}

const order = (value: PickList) => value.entries.map((entry) => entry.team);

describe('pick list editing', () => {
	it('adds a team to the end with an optional name', () => {
		const next = addEntry(list(1, 2), 3, 'Valley X Robotics');
		expect(order(next)).toEqual([1, 2, 3]);
		expect(next.entries[2]).toEqual({
			team: 3,
			name: 'Valley X Robotics',
			note: '',
			taken: false
		});
	});

	it('does not add the same team twice or a bad number', () => {
		const start = list(1, 2);
		expect(addEntry(start, 2)).toBe(start);
		expect(addEntry(start, 0)).toBe(start);
		expect(addEntry(start, 1_000_000)).toBe(start);
		expect(addEntry(start, 1.5)).toBe(start);
	});

	it('says why a team cannot be added', () => {
		expect(checkAdd(list(1), 2)).toBe('ok');
		expect(checkAdd(list(1), 1)).toBe('duplicate');
		expect(checkAdd(list(1), -4)).toBe('invalid');
		expect(checkAdd(list(...Array.from({ length: 80 }, (_, index) => index + 1)), 500)).toBe(
			'full'
		);
	});

	it('removes a team', () => {
		expect(order(removeEntry(list(1, 2, 3), 2))).toEqual([1, 3]);
		expect(order(removeEntry(list(1, 2, 3), 9))).toEqual([1, 2, 3]);
	});

	it('keeps notes, names and taken marks on the right team', () => {
		let next = list(1, 2, 3);
		next = setNote(next, 2, 'Strong auto');
		next = setName(next, 3, 'The Titans');
		next = setTaken(next, 1, true);
		expect(next.entries).toEqual([
			{ team: 1, name: null, note: '', taken: true },
			{ team: 2, name: null, note: 'Strong auto', taken: false },
			{ team: 3, name: 'The Titans', note: '', taken: false }
		]);
		expect(setNote(next, 2, 'x'.repeat(400)).entries[1].note).toHaveLength(300);
	});

	it('sets the event code', () => {
		expect(setEvent(list(1), 'USAZGIQ').event).toBe('USAZGIQ');
		expect(setEvent(setEvent(list(1), 'USAZGIQ'), null).event).toBeNull();
	});
});

describe('reordering', () => {
	it('moves a team up and down', () => {
		expect(order(moveEntry(list(1, 2, 3, 4), 3, 0))).toEqual([3, 1, 2, 4]);
		expect(order(moveEntry(list(1, 2, 3, 4), 2, 3))).toEqual([1, 3, 4, 2]);
		expect(order(moveEntry(list(1, 2, 3, 4), 4, 1))).toEqual([1, 4, 2, 3]);
	});

	it('keeps notes with the team that moved', () => {
		const start = setNote(list(1, 2, 3), 3, 'Best parker');
		const next = moveEntry(start, 3, 0);
		expect(next.entries[0]).toMatchObject({ team: 3, note: 'Best parker' });
	});

	it('clamps targets and ignores missing teams', () => {
		expect(order(moveEntry(list(1, 2, 3), 2, -5))).toEqual([2, 1, 3]);
		expect(order(moveEntry(list(1, 2, 3), 2, 99))).toEqual([1, 3, 2]);
		const start = list(1, 2, 3);
		expect(moveEntry(start, 9, 0)).toBe(start);
		expect(moveEntry(start, 2, 1)).toBe(start);
	});

	it('does not change the other fields', () => {
		const start: PickList = { ...list(1, 2), event: 'USAZGIQ' };
		expect(moveEntry(start, 2, 0).event).toBe('USAZGIQ');
	});
});

describe('drag position', () => {
	const centers = [20, 60, 100, 140];

	it('keeps the row in place for a small drag', () => {
		expect(indexAtOffset(centers, 1, 0)).toBe(1);
		expect(indexAtOffset(centers, 1, 15)).toBe(1);
		expect(indexAtOffset(centers, 1, -15)).toBe(1);
	});

	it('moves down once the row passes the next center', () => {
		expect(indexAtOffset(centers, 1, 45)).toBe(2);
		expect(indexAtOffset(centers, 1, 85)).toBe(3);
		expect(indexAtOffset(centers, 1, 400)).toBe(3);
	});

	it('moves up once the row passes the previous center', () => {
		expect(indexAtOffset(centers, 3, -45)).toBe(2);
		expect(indexAtOffset(centers, 3, -85)).toBe(1);
		expect(indexAtOffset(centers, 3, -400)).toBe(0);
	});

	it('agrees with moveEntry when applied', () => {
		const start = list(1, 2, 3, 4);
		const target = indexAtOffset(centers, 3, -85);
		expect(order(moveEntry(start, 4, target))).toEqual([1, 4, 2, 3]);
	});
});
