import { describe, expect, it } from 'vitest';
import {
	addEntry,
	moveEntry,
	pickListCsv,
	pickListText,
	pickMarks,
	removeEntry,
	restoreEntry,
	setAvoid,
	setNote,
	statText,
	toggleTag
} from '#lib/workspace/picklist.ts';
import { DOC_BYTE_LIMITS } from '#lib/workspace/redis-store.ts';
import {
	LIMITS,
	parseDoc,
	PICK_TAGS,
	snapshotSchema,
	type PickList
} from '#lib/workspace/schemas.ts';

function list(...teams: number[]): PickList {
	return {
		event: null,
		entries: teams.map((team) => ({ team, name: null, note: '', taken: false }))
	};
}

const order = (value: PickList) => value.entries.map((entry) => entry.team);

describe('documents saved before tags and do not pick', () => {
	it('loads an old pick list unchanged', () => {
		const old = {
			event: 'USAZGIQ',
			entries: [
				{ team: 2844, name: 'Valley X Robotics', note: 'Best auto', taken: true },
				{ team: 14624, name: null, note: '', taken: false }
			]
		};
		const parsed = parseDoc('picklist', old);
		expect(parsed).toEqual(old);
		expect(parsed?.entries[0]).not.toHaveProperty('tags');
		expect(parsed?.entries[0]).not.toHaveProperty('avoid');
	});

	it('loads an old stored snapshot with bare entries', () => {
		const snapshot = snapshotSchema.parse({
			meta: { code: '247VSS', teamNumber: 14624, createdAt: 1 },
			docs: { picklist: { updatedAt: 5, data: { entries: [{ team: 2844 }] } } }
		});
		expect(snapshot.docs.picklist?.data.entries).toEqual([
			{ team: 2844, name: null, note: '', taken: false }
		]);
		expect(order(addEntry(snapshot.docs.picklist!.data, 1))).toEqual([2844, 1]);
	});

	it('keeps tags and do not pick through a save', () => {
		const saved = setAvoid(toggleTag(list(1, 2), 2, 'defense'), 1, true);
		expect(parseDoc('picklist', JSON.parse(JSON.stringify(saved)))).toEqual(saved);
	});

	it('rejects unknown tags', () => {
		expect(
			parseDoc('picklist', { entries: [{ team: 1, tags: ['fast'] }], event: null })
		).toBeNull();
	});

	it('fits a full list with every field at its longest under the size cap', () => {
		const full: PickList = {
			event: 'A'.repeat(24),
			entries: Array.from({ length: LIMITS.picks }, (_, index) => ({
				team: 900_000 + index,
				name: 'n'.repeat(80),
				note: 'x'.repeat(300),
				taken: true,
				tags: [...PICK_TAGS],
				avoid: true
			}))
		};
		const payload = JSON.stringify({ updatedAt: Date.now(), data: full });
		expect(payload.length).toBeLessThanOrEqual(DOC_BYTE_LIMITS.picklist);
	});

	it('adds nothing to entries that have no tags or flags', () => {
		const tagged = toggleTag(toggleTag(list(1), 1, 'auto'), 1, 'auto');
		const back = setAvoid(setAvoid(tagged, 1, true), 1, false);
		expect(JSON.stringify(back)).toBe(JSON.stringify(list(1)));
	});
});

describe('do not pick', () => {
	it('moves a team below the ranked teams and back to the end of them', () => {
		const avoided = setAvoid(list(1, 2, 3), 1, true);
		expect(order(avoided)).toEqual([2, 3, 1]);
		expect(avoided.entries[2].avoid).toBe(true);
		const back = setAvoid(addEntry(avoided, 4), 1, false);
		expect(order(back)).toEqual([2, 3, 4, 1]);
		expect(back.entries[3]).not.toHaveProperty('avoid');
	});

	it('adds new teams above the do not pick teams', () => {
		expect(order(addEntry(setAvoid(list(1, 2), 1, true), 3))).toEqual([2, 3, 1]);
	});

	it('moves teams within their own group', () => {
		const start = setAvoid(setAvoid(list(1, 2, 3, 4), 3, true), 4, true);
		expect(order(moveEntry(start, 2, 0))).toEqual([2, 1, 3, 4]);
		expect(order(moveEntry(start, 4, 0))).toEqual([1, 2, 4, 3]);
		expect(order(moveEntry(start, 1, 9))).toEqual([2, 1, 3, 4]);
	});

	it('leaves the list alone for unknown teams or no change', () => {
		const start = list(1, 2);
		expect(setAvoid(start, 9, true)).toBe(start);
		expect(setAvoid(start, 1, false)).toBe(start);
	});
});

describe('tags', () => {
	it('toggles tags in a fixed order and drops the field when empty', () => {
		let next = toggleTag(list(1), 1, 'risky');
		next = toggleTag(next, 1, 'auto');
		expect(next.entries[0].tags).toEqual(['auto', 'risky']);
		next = toggleTag(toggleTag(next, 1, 'auto'), 1, 'risky');
		expect(next.entries[0]).not.toHaveProperty('tags');
	});
});

describe('undoing a removal', () => {
	it('puts the team back where it was with its note and tags', () => {
		const start = toggleTag(list(1, 2, 3), 2, 'defense');
		const entry = { ...start.entries[1], note: 'Watch the lift' };
		const removed = removeEntry(start, 2);
		const restored = restoreEntry(removed, entry, 1);
		expect(order(restored)).toEqual([1, 2, 3]);
		expect(restored.entries[1]).toEqual(entry);
	});

	it('does not duplicate a team someone added again', () => {
		const start = list(1, 2);
		expect(restoreEntry(start, start.entries[0], 0)).toBe(start);
	});

	it('keeps a do not pick team in its group', () => {
		const start = setAvoid(list(1, 2, 3), 1, true);
		const entry = start.entries[2];
		expect(order(restoreEntry(removeEntry(start, 1), entry, 0))).toEqual([2, 3, 1]);
	});
});

describe('export', () => {
	const sample = (): PickList => {
		let next: PickList = {
			event: 'USAZGIQ',
			entries: [
				{ team: 2844, name: 'Valley X', note: 'Great driver, "fast"', taken: false },
				{ team: 14624, name: null, note: '', taken: true },
				{ team: 7, name: 'Seven', note: '', taken: false }
			]
		};
		next = toggleTag(next, 2844, 'defense');
		return setAvoid(next, 7, true);
	};
	const context = {
		labels: new Map([[14624, 'Picked by alliance 2']]),
		stats: new Map([[2844, { opr: 51.234, rank: 3 }]])
	};

	it('copies as readable text', () => {
		expect(pickListText(sample(), context)).toBe(
			[
				'Pick list, USAZGIQ',
				'1. 2844 Valley X - OPR 51.2 · #3 - Defense - Great driver, "fast"',
				'2. 14624 (picked by alliance 2)',
				'',
				'Do not pick',
				'- 7 Seven'
			].join('\n')
		);
	});

	it('writes a csv with quoted cells', () => {
		const rows = pickListCsv(sample(), context).split('\r\n');
		expect(rows[0]).toBe('rank,team,name,list,status,opr,event rank,tags,note');
		expect(rows[1]).toBe('1,2844,Valley X,pick,,51.2,3,Defense,"Great driver, ""fast"""');
		expect(rows[2]).toBe('2,14624,,pick,Picked by alliance 2,,,,');
		expect(rows[3]).toBe(',7,Seven,do not pick,,,,,');
	});

	it('formats stats only when they exist', () => {
		expect(statText(undefined)).toBe('');
		expect(statText({ opr: null, rank: 4 })).toBe('#4');
		expect(statText({ opr: 12, rank: null })).toBe('OPR 12.0');
	});
});

describe('marks for the alliance selection table', () => {
	it('gives each team its place, tags and note', () => {
		const marks = pickMarks(
			setNote(toggleTag(setAvoid(list(1, 2, 3), 1, true), 3, 'auto'), 3, ' Quick ')
		);
		expect(marks.get(2)).toEqual({ rank: 1, text: 'Our #1' });
		expect(marks.get(3)).toEqual({ rank: 2, text: 'Our #2 · Strong auto · Quick' });
		expect(marks.get(1)).toEqual({ rank: null, text: 'Do not pick' });
		expect(marks.has(9)).toBe(false);
	});
});
