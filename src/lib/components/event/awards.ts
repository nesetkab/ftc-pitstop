import { ordinal } from '#lib/format/ordinal.ts';
import type { Award } from '#lib/types.ts';

export type AwardEntry = {
	label: string | null;
	team: number | null;
	person: string | null;
};

export type AwardGroup = {
	id: number;
	name: string;
	entries: AwardEntry[];
};

const PLACE = /\s+\d+(?:st|nd|rd|th)\s+place$/i;
const ROLE = /\s+-\s+/;

export function plainName(name: string): string {
	return name
		.replace(/<[^>]*>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
}

function split(name: string): { base: string; role: string | null } {
	const clean = plainName(name);
	const role = ROLE.exec(clean);
	if (role)
		return { base: clean.slice(0, role.index), role: clean.slice(role.index + role[0].length) };
	return { base: clean.replace(PLACE, ''), role: null };
}

export function groupAwards(awards: Award[]): AwardGroup[] {
	const groups = new Map<number, { name: string; items: (Award & { role: string | null })[] }>();
	for (const award of awards) {
		const { base, role } = split(award.name);
		const group = groups.get(award.id) ?? { name: base, items: [] };
		if (award.placement === 1 || !groups.has(award.id)) group.name = base;
		group.items.push({ ...award, role });
		groups.set(award.id, group);
	}
	const result: AwardGroup[] = [];
	for (const [id, group] of groups) {
		const given = group.items
			.filter((item) => item.team !== null || item.person !== null)
			.sort((a, b) => a.placement - b.placement);
		if (given.length === 0) continue;
		const placements = new Set(group.items.map((item) => item.placement));
		result.push({
			id,
			name: group.name,
			entries: given.map((item) => ({
				label: item.role ?? (placements.size > 1 ? `${ordinal(item.placement)} place` : null),
				team: item.team,
				person: item.person
			}))
		});
	}
	return result;
}
