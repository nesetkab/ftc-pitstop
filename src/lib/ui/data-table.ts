import type { Snippet } from 'svelte';

export type SortDir = 'asc' | 'desc';

export interface SortState {
	key: string;
	dir: SortDir;
}

export interface Column<T> {
	key: string;
	label: string;
	term?: boolean;
	title?: string;
	numeric?: boolean;
	sort?: (row: T) => number | string | null;
	first?: SortDir;
	text?: (row: T) => string;
	cell?: Snippet<[T]>;
	hide?: 'phone' | 'tablet';
	strong?: boolean;
	fill?: boolean;
	class?: string;
}

export function firstDir<T>(column: Column<T>): SortDir {
	return column.first ?? (column.numeric ? 'desc' : 'asc');
}

export function nextSort<T>(column: Column<T>, sort: SortState | null): SortState {
	if (sort?.key !== column.key) return { key: column.key, dir: firstDir(column) };
	return { key: column.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
}

function compare(a: number | string | null, b: number | string | null): number {
	if (a === b) return 0;
	if (a === null) return 1;
	if (b === null) return -1;
	if (typeof a === 'number' && typeof b === 'number') return a - b;
	return String(a).localeCompare(String(b), 'en', { numeric: true });
}

export function sortRows<T>(rows: readonly T[], columns: Column<T>[], sort: SortState | null): T[] {
	const column = sort ? columns.find((entry) => entry.key === sort.key) : undefined;
	const read = column?.sort;
	if (!sort || !read) return [...rows];
	const sign = sort.dir === 'asc' ? 1 : -1;
	return rows
		.map((row, index) => ({ row, index, value: read(row) }))
		.sort((a, b) => {
			if (a.value === null || b.value === null)
				return compare(a.value, b.value) || a.index - b.index;
			return sign * compare(a.value, b.value) || a.index - b.index;
		})
		.map((entry) => entry.row);
}
