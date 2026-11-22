import { describe, expect, it } from 'vitest';
import { addItem, removeItem, renameItem, toggleItem } from '#lib/workspace/checklist.ts';
import { memoryStorage } from '#lib/workspace/device-store.ts';
import { createPendingStore, mergeDoc, replayEdit } from '#lib/workspace/pending.ts';
import { addEntry, moveEntry, removeEntry, setNote } from '#lib/workspace/picklist.ts';
import { emptyDoc, type Checklist, type PickList } from '#lib/workspace/schemas.ts';

const picks = (...teams: number[]): PickList =>
	teams.reduce((list, team) => addEntry(list, team), emptyDoc('picklist'));

const checks = (...ids: string[]): Checklist =>
	ids.reduce((list, id) => addItem(list, id, `Item ${id}`), emptyDoc('checklist'));

const teams = (list: PickList) => list.entries.map((entry) => entry.team);

describe('mergeDoc', () => {
	it('takes whichever side changed when only one did', () => {
		const base = picks(1, 2);
		const changed = addEntry(base, 3);
		expect(mergeDoc(base, changed, base)).toBe(changed);
		expect(mergeDoc(base, base, changed)).toBe(changed);
	});

	it('keeps teams both people added', () => {
		const base = picks(1, 2);
		const merged = mergeDoc(base, addEntry(base, 3), addEntry(base, 4));
		expect(teams(merged)).toEqual([1, 2, 4, 3]);
	});

	it('keeps a removal from one side and a note from the other', () => {
		const base = picks(1, 2, 3);
		const merged = mergeDoc(base, removeEntry(base, 2), setNote(base, 3, 'fast'));
		expect(teams(merged)).toEqual([1, 3]);
		expect(merged.entries[1].note).toBe('fast');
	});

	it('keeps an edited item that someone else removed', () => {
		const base = picks(1, 2);
		const merged = mergeDoc(base, setNote(base, 2, 'keep me'), removeEntry(base, 2));
		expect(teams(merged)).toEqual([1, 2]);
	});

	it('follows a reorder made offline and still adds the new teams from others', () => {
		const base = picks(1, 2, 3);
		const merged = mergeDoc(base, moveEntry(base, 3, 0), addEntry(base, 4));
		expect(teams(merged)).toEqual([3, 1, 2, 4]);
	});

	it('follows a reorder from others when the offline edit kept the order', () => {
		const base = picks(1, 2, 3);
		const merged = mergeDoc(base, setNote(base, 1, 'x'), moveEntry(base, 3, 0));
		expect(teams(merged)).toEqual([3, 1, 2]);
		expect(merged.entries[1].note).toBe('x');
	});

	it('merges checklist items by id and lets the offline edit win a direct clash', () => {
		const base = checks('a', 'b');
		const ours = renameItem(toggleItem(base, 'a', 'NK', 5), 'b', 'Mine');
		const theirs = renameItem(removeItem(addItem(base, 'c', 'Theirs'), 'a'), 'b', 'Other');
		const merged = mergeDoc(base, ours, theirs);
		expect(merged.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
		expect(merged.items[0].by).toBe('NK');
		expect(merged.items[1].text).toBe('Mine');
	});

	it('treats plain value lists as a whole', () => {
		expect(mergeDoc({ used: ['Q1'] }, { used: ['Q1', 'Q2'] }, { used: ['Q3'] })).toEqual({
			used: ['Q1', 'Q2']
		});
	});
});

describe('replayEdit', () => {
	it('puts an offline edit on top of whatever the doc is now', () => {
		const from = picks(1);
		const replay = replayEdit<'picklist'>({ from, data: addEntry(from, 2) });
		expect(teams(replay(from))).toEqual([1, 2]);
		expect(teams(replay(addEntry(from, 9)))).toEqual([1, 9, 2]);
	});
});

describe('createPendingStore', () => {
	it('saves, reads and clears an edit', () => {
		const storage = memoryStorage();
		const store = createPendingStore(storage);
		const edit = { from: picks(1), data: picks(1, 2) };
		store.save('ABC234', 'picklist', edit);
		expect(store.read('ABC234', 'picklist')).toEqual(edit);
		expect(store.read('ABC234', 'checklist')).toBeNull();
		store.clear('ABC234', 'picklist');
		expect(store.read('ABC234', 'picklist')).toBeNull();
	});

	it('ignores broken or invalid entries', () => {
		const storage = memoryStorage();
		const store = createPendingStore(storage);
		storage.setItem('ps-pending:ABC234:picklist', '{not json');
		expect(store.read('ABC234', 'picklist')).toBeNull();
		storage.setItem('ps-pending:ABC234:picklist', JSON.stringify({ from: {}, data: 7 }));
		expect(store.read('ABC234', 'picklist')).toBeNull();
	});

	it('keeps working when storage throws', () => {
		const broken = {
			...memoryStorage(),
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('full');
			},
			removeItem: () => {
				throw new Error('blocked');
			}
		};
		const store = createPendingStore(broken);
		expect(() => store.save('ABC234', 'picklist', { from: picks(), data: picks(1) })).not.toThrow();
		expect(store.read('ABC234', 'picklist')).toBeNull();
		expect(() => store.clear('ABC234', 'picklist')).not.toThrow();
	});
});
