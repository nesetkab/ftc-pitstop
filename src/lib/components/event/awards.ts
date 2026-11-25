import { ordinal } from '#lib/format/ordinal.ts';
import type { Award, EventType } from '#lib/types.ts';

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

const PLACE = /\s+(\d+)(?:st|nd|rd|th)\s+place$/i;
const ROLE = /\s+-\s+/;
const PICK = /^(\d+(?:st|nd|rd|th)) team selected$/i;
const ALLIANCES: Record<string, string> = {
	'winning alliance': 'Winning alliance',
	'finalist alliance': 'Finalist alliance'
};

export function plainName(name: string): string {
	return name
		.replace(/<[^>]*>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/®/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function baseName(name: string): string {
	return ALLIANCES[name.toLowerCase()] ?? name;
}

function roleName(role: string): string {
	const pick = PICK.exec(role);
	if (pick) return `${pick[1]} pick`;
	return role.toLowerCase() === 'captain' ? 'captain' : role;
}

function placeName(placement: number): string {
	return `${ordinal(placement)} place`;
}

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function split(name: string): { base: string; role: string | null; place: number | null } {
	const clean = plainName(name);
	const role = ROLE.exec(clean);
	if (role) {
		return {
			base: baseName(clean.slice(0, role.index)),
			role: roleName(clean.slice(role.index + role[0].length)),
			place: null
		};
	}
	const place = PLACE.exec(clean);
	return {
		base: baseName(place ? clean.slice(0, place.index) : clean),
		role: null,
		place: place ? Number(place[1]) : null
	};
}

export function awardName(award: { name: string; placement?: number }): string {
	const { base, role, place } = split(award.name);
	const placement = place ?? award.placement ?? 1;
	const detail = role ?? (placement > 1 ? placeName(placement) : null);
	return detail ? `${base} ${detail}` : base;
}

function labelFor(role: string | null, placement: number, placed: boolean): string | null {
	if (role) return capitalize(role);
	return placed ? capitalize(placeName(placement)) : null;
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
		const placements = new Set(given.map((item) => item.placement));
		result.push({
			id,
			name: group.name,
			entries: given.map((item) => ({
				label: labelFor(item.role, item.placement, placements.size > 1),
				team: item.team,
				person: item.person
			}))
		});
	}
	return result;
}

export function noAwardsText(type: EventType): { title: string; body?: string } {
	if (type === 'LeagueMeet') {
		return {
			title: "League meets don't give awards.",
			body: 'Awards are handed out at the league tournament.'
		};
	}
	return { title: 'No awards have been announced yet.' };
}
