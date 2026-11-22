import type { StorageLike } from '#lib/workspace/device-store.ts';
import { parseDoc, type DocMap, type DocName } from '#lib/workspace/schemas.ts';

export interface PendingEdit<K extends DocName = DocName> {
	from: DocMap[K];
	data: DocMap[K];
}

export interface PendingStore {
	read<K extends DocName>(code: string, name: K): PendingEdit<K> | null;
	save<K extends DocName>(code: string, name: K, edit: PendingEdit<K>): void;
	clear(code: string, name: DocName): void;
}

type Plain = Record<string, unknown>;

function isPlain(value: unknown): value is Plain {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function equal(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((item, index) => equal(item, b[index]));
	}
	if (!isPlain(a) || !isPlain(b)) return false;
	const keys = Object.keys(a).filter((key) => a[key] !== undefined);
	const other = Object.keys(b).filter((key) => b[key] !== undefined);
	return keys.length === other.length && keys.every((key) => equal(a[key], b[key]));
}

function identity(item: unknown): string | null {
	if (!isPlain(item)) return null;
	if (typeof item.id === 'string') return `id:${item.id}`;
	if (typeof item.team === 'number') return `team:${item.team}`;
	return null;
}

function keyed(list: unknown[]): Map<string, unknown> | null {
	const map = new Map<string, unknown>();
	for (const item of list) {
		const key = identity(item);
		if (key === null || map.has(key)) return null;
		map.set(key, item);
	}
	return map;
}

function sameOrder(a: string[], b: string[]): boolean {
	const shared = a.filter((key) => b.includes(key));
	const other = b.filter((key) => a.includes(key));
	return equal(shared, other);
}

function weave(primary: string[], secondary: string[]): string[] {
	const result = [...primary];
	secondary.forEach((key, index) => {
		if (result.includes(key)) return;
		const after = secondary.slice(index + 1).some((other) => primary.includes(other));
		if (!after) {
			result.push(key);
			return;
		}
		const before = secondary
			.slice(0, index)
			.reverse()
			.find((other) => result.includes(other));
		result.splice(before === undefined ? 0 : result.indexOf(before) + 1, 0, key);
	});
	return result;
}

function mergeList(base: unknown[], ours: unknown[], theirs: unknown[]): unknown[] | null {
	const baseMap = keyed(base);
	const ourMap = keyed(ours);
	const theirMap = keyed(theirs);
	if (!baseMap || !ourMap || !theirMap) return null;
	const ourKeys = [...ourMap.keys()];
	const theirKeys = [...theirMap.keys()];
	const baseKeys = [...baseMap.keys()];
	const order = sameOrder(ourKeys, baseKeys)
		? weave(theirKeys, ourKeys)
		: weave(ourKeys, theirKeys);
	const merged: unknown[] = [];
	for (const key of order) {
		const before = baseMap.get(key);
		const mine = ourMap.get(key);
		const other = theirMap.get(key);
		if (mine !== undefined && other !== undefined) {
			merged.push(mergeDoc(before, mine, other));
		} else if (mine !== undefined) {
			if (before === undefined || !equal(mine, before)) merged.push(mine);
		} else if (other !== undefined) {
			if (before === undefined || !equal(other, before)) merged.push(other);
		}
	}
	return merged;
}

export function mergeDoc<T>(base: unknown, ours: T, theirs: T): T {
	if (equal(ours, base) || equal(ours, theirs)) return theirs;
	if (equal(theirs, base)) return ours;
	if (Array.isArray(ours) && Array.isArray(theirs)) {
		return (mergeList(Array.isArray(base) ? base : [], ours, theirs) ?? ours) as T;
	}
	if (isPlain(ours) && isPlain(theirs)) {
		const before = isPlain(base) ? base : {};
		const keys = [...new Set([...Object.keys(ours), ...Object.keys(theirs)])];
		const merged: Plain = {};
		for (const key of keys) {
			const value = mergeDoc(before[key], ours[key], theirs[key]);
			if (value !== undefined) merged[key] = value;
		}
		return merged as T;
	}
	return ours;
}

export function replayEdit<K extends DocName>(edit: PendingEdit<K>) {
	return (current: DocMap[K]): DocMap[K] => mergeDoc(edit.from, edit.data, current);
}

export function createPendingStore(storage: StorageLike, prefix = 'ps-pending'): PendingStore {
	const key = (code: string, name: DocName) => `${prefix}:${code}:${name}`;
	return {
		read(code, name) {
			try {
				const raw = storage.getItem(key(code, name));
				if (raw === null) return null;
				const value: unknown = JSON.parse(raw);
				if (!isPlain(value)) return null;
				const from = parseDoc(name, value.from);
				const data = parseDoc(name, value.data);
				return from && data ? { from, data } : null;
			} catch {
				return null;
			}
		},
		save(code, name, edit) {
			try {
				storage.setItem(key(code, name), JSON.stringify(edit));
			} catch {
				return;
			}
		},
		clear(code, name) {
			try {
				storage.removeItem(key(code, name));
			} catch {
				return;
			}
		}
	};
}
