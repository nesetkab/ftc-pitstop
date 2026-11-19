import { LIMITS, type PickList } from '#lib/workspace/schemas.ts';

export type AddStatus = 'ok' | 'duplicate' | 'invalid' | 'full';

export function checkAdd(list: PickList, team: number): AddStatus {
	if (!Number.isInteger(team) || team < 1 || team > 999_999) return 'invalid';
	if (list.entries.some((entry) => entry.team === team)) return 'duplicate';
	if (list.entries.length >= LIMITS.picks) return 'full';
	return 'ok';
}

export function addEntry(list: PickList, team: number, name: string | null = null): PickList {
	if (checkAdd(list, team) !== 'ok') return list;
	return { ...list, entries: [...list.entries, { team, name, note: '', taken: false }] };
}

export function removeEntry(list: PickList, team: number): PickList {
	return { ...list, entries: list.entries.filter((entry) => entry.team !== team) };
}

export function moveEntry(list: PickList, team: number, to: number): PickList {
	const from = list.entries.findIndex((entry) => entry.team === team);
	if (from === -1) return list;
	const target = Math.min(Math.max(to, 0), list.entries.length - 1);
	if (target === from) return list;
	const entries = [...list.entries];
	const [moved] = entries.splice(from, 1);
	entries.splice(target, 0, moved);
	return { ...list, entries };
}

function update(
	list: PickList,
	team: number,
	change: (entry: PickList['entries'][number]) => PickList['entries'][number]
): PickList {
	return {
		...list,
		entries: list.entries.map((entry) => (entry.team === team ? change(entry) : entry))
	};
}

export function setNote(list: PickList, team: number, note: string): PickList {
	return update(list, team, (entry) => ({ ...entry, note: note.slice(0, 300) }));
}

export function setName(list: PickList, team: number, name: string | null): PickList {
	return update(list, team, (entry) => ({ ...entry, name }));
}

export function setTaken(list: PickList, team: number, taken: boolean): PickList {
	return update(list, team, (entry) => ({ ...entry, taken }));
}

export function setEvent(list: PickList, event: string | null): PickList {
	return { ...list, event };
}

export function indexAtOffset(centers: readonly number[], from: number, offset: number): number {
	const dragged = (centers[from] ?? 0) + offset;
	let index = 0;
	centers.forEach((center, position) => {
		if (position !== from && center < dragged) index += 1;
	});
	return index;
}
