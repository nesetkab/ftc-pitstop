import { LIMITS, type CheckItem, type Checklist } from '#lib/workspace/schemas.ts';

export const EXAMPLE_ITEMS = [
	'Battery in and strapped down',
	'Robot powered on with no warnings',
	'Driver hub charged, gamepads paired',
	'Correct autonomous selected',
	'Human player ready'
] as const;

export function progress(list: Checklist): { done: number; total: number } {
	return {
		done: list.items.filter((item) => item.at !== null).length,
		total: list.items.length
	};
}

export function toggleItem(list: Checklist, id: string, by: string, now: number): Checklist {
	return {
		...list,
		items: list.items.map((item) => {
			if (item.id !== id) return item;
			return item.at === null
				? { ...item, by: by || null, at: now }
				: { ...item, by: null, at: null };
		})
	};
}

export function addItem(list: Checklist, id: string, text: string): Checklist {
	const label = text.trim().slice(0, 160);
	if (!label || list.items.length >= LIMITS.checks) return list;
	if (list.items.some((item) => item.id === id)) return list;
	return { ...list, items: [...list.items, { id, text: label, by: null, at: null }] };
}

export function addItems(
	list: Checklist,
	items: readonly { id: string; text: string }[]
): Checklist {
	return items.reduce((next, item) => addItem(next, item.id, item.text), list);
}

export function renameItem(list: Checklist, id: string, text: string): Checklist {
	return {
		...list,
		items: list.items.map((item) => (item.id === id ? { ...item, text: text.slice(0, 160) } : item))
	};
}

export function removeItem(list: Checklist, id: string): Checklist {
	return { ...list, items: list.items.filter((item) => item.id !== id) };
}

export function moveItem(list: Checklist, id: string, to: number): Checklist {
	const from = list.items.findIndex((item) => item.id === id);
	if (from === -1) return list;
	const target = Math.min(Math.max(to, 0), list.items.length - 1);
	if (target === from) return list;
	const items = [...list.items];
	const [moved] = items.splice(from, 1);
	items.splice(target, 0, moved);
	return { ...list, items };
}

export function setMatch(list: Checklist, match: string): Checklist {
	return { ...list, match: match.trim().slice(0, 16) };
}

export function nextMatchLabel(label: string): string {
	const found = /^(.*?)(\d+)$/.exec(label.trim());
	return found ? `${found[1]}${Number(found[2]) + 1}` : label.trim();
}

export function resetForNextMatch(list: Checklist, now: number): Checklist {
	const { done, total } = progress(list);
	const by = [
		...new Set(list.items.map((item: CheckItem) => item.by).filter((who): who is string => !!who))
	];
	const history =
		done > 0
			? [{ match: list.match, at: now, done, total, by }, ...list.history].slice(0, LIMITS.history)
			: list.history;
	return {
		match: nextMatchLabel(list.match),
		items: list.items.map((item) => ({ ...item, by: null, at: null })),
		history
	};
}

export function restoreItem(list: Checklist, item: CheckItem, index: number): Checklist {
	if (list.items.length >= LIMITS.checks || list.items.some((known) => known.id === item.id)) {
		return list;
	}
	const items = [...list.items];
	items.splice(Math.min(Math.max(index, 0), items.length), 0, item);
	return { ...list, items };
}

export function undoReset(list: Checklist, before: Checklist, now: number): Checklist {
	const checks = new Map(before.items.map((item) => [item.id, item]));
	return {
		match: before.match,
		items: list.items.map((item) => {
			const old = checks.get(item.id);
			return old && item.at === null ? { ...item, by: old.by, at: old.at } : item;
		}),
		history: list.history[0]?.at === now ? list.history.slice(1) : list.history
	};
}
