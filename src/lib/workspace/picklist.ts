import {
	LIMITS,
	PICK_TAGS,
	type PickEntry,
	type PickList,
	type PickTag
} from '#lib/workspace/schemas.ts';

export type AddStatus = 'ok' | 'duplicate' | 'invalid' | 'full';

export interface PickStat {
	opr: number | null;
	rank: number | null;
}

export interface PickContext {
	labels?: ReadonlyMap<number, string>;
	stats?: ReadonlyMap<number, PickStat>;
}

export const TAG_LABELS: Record<PickTag, string> = {
	auto: 'Strong auto',
	cycles: 'Fast cycles',
	endgame: 'Endgame',
	defense: 'Defense',
	steady: 'Consistent',
	risky: 'Breaks down'
};

export function checkAdd(list: PickList, team: number): AddStatus {
	if (!Number.isInteger(team) || team < 1 || team > 999_999) return 'invalid';
	if (list.entries.some((entry) => entry.team === team)) return 'duplicate';
	if (list.entries.length >= LIMITS.picks) return 'full';
	return 'ok';
}

export function ranked(list: PickList): PickEntry[] {
	return list.entries.filter((entry) => !entry.avoid);
}

export function avoided(list: PickList): PickEntry[] {
	return list.entries.filter((entry) => entry.avoid);
}

function ordered(list: PickList, entries: PickEntry[]): PickList {
	return {
		...list,
		entries: [...entries.filter((entry) => !entry.avoid), ...entries.filter((entry) => entry.avoid)]
	};
}

export function addEntry(list: PickList, team: number, name: string | null = null): PickList {
	if (checkAdd(list, team) !== 'ok') return list;
	return ordered(list, [...list.entries, { team, name, note: '', taken: false }]);
}

export function removeEntry(list: PickList, team: number): PickList {
	return { ...list, entries: list.entries.filter((entry) => entry.team !== team) };
}

export function restoreEntry(list: PickList, entry: PickEntry, index: number): PickList {
	if (checkAdd(list, entry.team) !== 'ok') return list;
	const entries = [...list.entries];
	entries.splice(Math.min(Math.max(index, 0), entries.length), 0, entry);
	return ordered(list, entries);
}

export function moveEntry(list: PickList, team: number, to: number): PickList {
	const entry = list.entries.find((item) => item.team === team);
	if (!entry) return list;
	const group = list.entries.filter((item) => Boolean(item.avoid) === Boolean(entry.avoid));
	const from = group.indexOf(entry);
	const target = Math.min(Math.max(to, 0), group.length - 1);
	if (target === from) return list;
	group.splice(from, 1);
	group.splice(target, 0, entry);
	const others = list.entries.filter((item) => Boolean(item.avoid) !== Boolean(entry.avoid));
	return ordered(list, entry.avoid ? [...others, ...group] : [...group, ...others]);
}

function update(list: PickList, team: number, change: (entry: PickEntry) => PickEntry): PickList {
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

export function setAvoid(list: PickList, team: number, avoid: boolean): PickList {
	const entry = list.entries.find((item) => item.team === team);
	if (!entry || Boolean(entry.avoid) === avoid) return list;
	const changed: PickEntry = { ...entry };
	if (avoid) changed.avoid = true;
	else delete changed.avoid;
	return ordered(list, [...list.entries.filter((item) => item !== entry), changed]);
}

export function toggleTag(list: PickList, team: number, tag: PickTag): PickList {
	return update(list, team, (entry) => {
		const current = new Set(entry.tags ?? []);
		if (current.has(tag)) current.delete(tag);
		else current.add(tag);
		const tags = PICK_TAGS.filter((known) => current.has(known));
		const changed: PickEntry = { ...entry, tags };
		if (tags.length === 0) delete changed.tags;
		return changed;
	});
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

export function tagText(entry: PickEntry): string {
	return (entry.tags ?? []).map((tag) => TAG_LABELS[tag]).join(', ');
}

export function statText(stat: PickStat | undefined): string {
	if (!stat) return '';
	return [
		stat.opr === null ? '' : `OPR ${stat.opr.toFixed(1)}`,
		stat.rank === null ? '' : `#${stat.rank}`
	]
		.filter(Boolean)
		.join(' · ');
}

function status(entry: PickEntry, context: PickContext): string {
	return context.labels?.get(entry.team) ?? (entry.taken ? 'Taken' : '');
}

function line(entry: PickEntry, prefix: string, context: PickContext): string {
	const team = [entry.team, entry.name].filter(Boolean).join(' ');
	const taken = status(entry, context);
	const details = [statText(context.stats?.get(entry.team)), tagText(entry), entry.note.trim()]
		.filter(Boolean)
		.join(' - ');
	return `${prefix}${team}${taken ? ` (${taken.toLowerCase()})` : ''}${details ? ` - ${details}` : ''}`;
}

export function pickListText(list: PickList, context: PickContext = {}): string {
	const lines = [list.event ? `Pick list, ${list.event}` : 'Pick list'];
	lines.push(...ranked(list).map((entry, index) => line(entry, `${index + 1}. `, context)));
	const avoid = avoided(list);
	if (avoid.length > 0) {
		lines.push('', 'Do not pick', ...avoid.map((entry) => line(entry, '- ', context)));
	}
	return lines.join('\n');
}

function cell(value: string | number | null): string {
	const text = value === null ? '' : String(value);
	return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function pickListCsv(list: PickList, context: PickContext = {}): string {
	const header = ['rank', 'team', 'name', 'list', 'status', 'opr', 'event rank', 'tags', 'note'];
	const rows = [...ranked(list), ...avoided(list)].map((entry, index) => {
		const stat = context.stats?.get(entry.team);
		return [
			entry.avoid ? null : index + 1,
			entry.team,
			entry.name,
			entry.avoid ? 'do not pick' : 'pick',
			status(entry, context),
			stat?.opr === null || stat?.opr === undefined ? null : stat.opr.toFixed(1),
			stat?.rank ?? null,
			tagText(entry),
			entry.note
		];
	});
	return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

export interface PickMark {
	rank: number | null;
	text: string;
}

export function pickMarks(list: PickList): Map<number, PickMark> {
	const marks = new Map<number, PickMark>();
	const describe = (entry: PickEntry, lead: string) =>
		[lead, tagText(entry), entry.note.trim()].filter(Boolean).join(' · ');
	ranked(list).forEach((entry, index) => {
		marks.set(entry.team, { rank: index + 1, text: describe(entry, `Our #${index + 1}`) });
	});
	for (const entry of avoided(list)) {
		marks.set(entry.team, { rank: null, text: describe(entry, 'Do not pick') });
	}
	return marks;
}
