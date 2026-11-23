import { plainName } from '#lib/components/event/awards.ts';
import { eventStatus } from '#lib/components/event/dates.ts';
import { ordinal } from '#lib/format/ordinal.ts';
import { knownRegion, regionName } from '#lib/format/places.ts';
import type { Advancement, Award, EventSummary, EventType } from '#lib/types.ts';

export interface AdvancedEntry {
	team: number;
	name: string | null;
	slot: number;
	reasons: string[];
}

export interface EventResult {
	code: string;
	advancesTo: string | null;
	slots: number;
	teams: AdvancedEntry[];
	fetchedAt: number;
}

export interface AdvancedTeam extends AdvancedEntry {
	event: string;
	eventName: string;
	region: string | null;
	date: string;
}

export type FeederState = 'upcoming' | 'live' | 'pending' | 'done';

export interface Feeder {
	code: string;
	name: string;
	type: EventType;
	region: string | null;
	start: string;
	end: string;
	state: FeederState;
	slots: number | null;
	advanced: number;
	confirmed: boolean;
}

export type ChampionshipLevel = 'regional' | 'world';

export interface Championship {
	code: string;
	name: string;
	type: EventType | null;
	level: ChampionshipLevel;
	region: string | null;
	place: string | null;
	start: string | null;
	end: string | null;
	advancesTo: string | null;
	teams: AdvancedTeam[];
	feeders: Feeder[];
}

export interface AdvancementIndex {
	generatedAt: number;
	championships: Championship[];
	unassigned: Feeder[];
}

export interface RegionOption {
	value: string;
	label: string;
}

export const FEEDER_TYPES: ReadonlySet<EventType> = new Set([
	'Qualifier',
	'LeagueTournament',
	'SuperQualifier',
	'Championship',
	'Premier',
	'Pilot'
]);

const DESTINATION_TYPES: ReadonlySet<EventType> = new Set([
	'SuperQualifier',
	'Championship',
	'FIRSTChampionship',
	'Premier'
]);

const WORLD_TYPES: ReadonlySet<EventType> = new Set(['FIRSTChampionship', 'Premier']);
const ENTRY_TYPES: ReadonlySet<EventType> = new Set(['Qualifier', 'LeagueTournament']);
const WINNING_ID = 13;
const FINALIST_ID = 12;
const INSPIRE = /^inspire\b/i;

function awardWeight(award: Award): number {
	const place = award.placement;
	if (INSPIRE.test(plainName(award.name))) return 60 / 2 ** (place - 1);
	if (award.id === WINNING_ID) return 40;
	if (award.id === FINALIST_ID) return 20;
	return place === 1 ? 12 : place === 2 ? 6 : 3;
}

export function reasonFor(award: Award): string {
	const name = plainName(award.name)
		.replace(/\s+sponsored by .*$/i, '')
		.replace(/\s+\d+(?:st|nd|rd|th)\s+place$/i, '');
	const [base, role] = name.split(/\s+-\s+/);
	if (role) {
		const pick = /^(\d+(?:st|nd|rd|th)) team selected$/i.exec(role);
		const detail = pick ? `${pick[1]} pick` : role.toLowerCase();
		return `${base.charAt(0)}${base.slice(1).toLowerCase()} ${detail}`;
	}
	const short = base.replace(/\s+award$/i, '');
	return award.placement > 1 ? `${short} ${ordinal(award.placement)}` : short;
}

export function teamReasons(awards: Award[], team: number): string[] {
	const reasons = awards
		.filter((award) => award.team === team && !award.person)
		.sort((a, b) => awardWeight(b) - awardWeight(a))
		.map(reasonFor);
	return [...new Set(reasons)];
}

export function eventResult(
	code: string,
	advancement: Advancement,
	awards: Award[],
	names: ReadonlyMap<number, string>,
	fetchedAt: number
): EventResult {
	const teams = advancement.teams.flatMap((slot) => {
		if (slot.team === null || slot.declined || slot.status !== 'first') return [];
		return [
			{
				team: slot.team,
				name: names.get(slot.team) ?? null,
				slot: slot.slot,
				reasons: teamReasons(awards, slot.team)
			}
		];
	});
	return { code, advancesTo: advancement.advancesTo, slots: advancement.slots, teams, fetchedAt };
}

function place(event: EventSummary): string | null {
	const region = knownRegion(event.region);
	return region ?? ([event.city, event.state ?? event.country].filter(Boolean).join(', ') || null);
}

function byStart(
	a: { start: string | null; name: string },
	b: { start: string | null; name: string }
) {
	return (a.start ?? '9999').localeCompare(b.start ?? '9999') || a.name.localeCompare(b.name);
}

interface BuildInput {
	events: EventSummary[];
	results: Record<string, EventResult>;
	now: number;
}

export function buildAdvancementIndex({ events, results, now }: BuildInput): AdvancementIndex {
	const byCode = new Map(events.map((event) => [event.code, event]));
	const destinations = new Map<string, Championship>();

	function destination(code: string): Championship {
		let found = destinations.get(code);
		if (found) return found;
		const event = byCode.get(code);
		const type = event?.type ?? null;
		found = {
			code,
			name: event?.name ?? code,
			type,
			level: type && WORLD_TYPES.has(type) ? 'world' : 'regional',
			region: event?.region ?? null,
			place: event ? place(event) : null,
			start: event?.start ?? null,
			end: event?.end ?? null,
			advancesTo: null,
			teams: [],
			feeders: []
		};
		destinations.set(code, found);
		return found;
	}

	for (const event of events) if (DESTINATION_TYPES.has(event.type)) destination(event.code);

	const observed = new Map<string, Set<string | null>>();
	for (const result of Object.values(results)) {
		const event = byCode.get(result.code);
		if (!event) continue;
		const key = `${event.region}|${event.type}`;
		const seen = observed.get(key) ?? new Set();
		seen.add(result.advancesTo);
		observed.set(key, seen);
	}

	const world =
		events
			.filter((event) => event.type === 'FIRSTChampionship')
			.sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code))[0] ?? null;
	const inRegion = (region: string | null, type: EventType) =>
		events.filter((event) => event.region === region && event.type === type);

	function inferred(event: EventSummary): string | null | undefined {
		const seen = observed.get(`${event.region}|${event.type}`);
		const targets = [...(seen ?? [])].filter((target): target is string => target !== null);
		if (seen && targets.length === 0) return null;
		if (targets.length > 1) return undefined;
		if (event.type === 'Premier') return targets[0];
		if (event.type === 'Championship' || event.type === 'Pilot')
			return targets[0] ?? world?.code ?? null;
		const local = inRegion(event.region, 'Championship');
		if (ENTRY_TYPES.has(event.type)) local.push(...inRegion(event.region, 'SuperQualifier'));
		if (local.length > 1) return undefined;
		return targets[0] ?? local[0]?.code;
	}

	const unassigned: Feeder[] = [];
	for (const event of events) {
		if (!FEEDER_TYPES.has(event.type)) continue;
		const result = results[event.code];
		const status = eventStatus(event, now);
		const posted = result !== undefined && (result.slots > 0 || result.teams.length > 0);
		const state: FeederState =
			status === 'done' ? (posted ? 'done' : 'pending') : status === 'live' ? 'live' : 'upcoming';
		const target = result ? result.advancesTo : inferred(event);
		if (target === null || target === event.code) continue;
		const feeder: Feeder = {
			code: event.code,
			name: event.name,
			type: event.type,
			region: event.region,
			start: event.start,
			end: event.end,
			state,
			slots: result ? result.slots : null,
			advanced: result?.teams.length ?? 0,
			confirmed: Boolean(result)
		};
		if (target === undefined) {
			unassigned.push(feeder);
			continue;
		}
		const championship = destination(target);
		championship.feeders.push(feeder);
		if (destinations.has(event.code)) destination(event.code).advancesTo = target;
		for (const entry of result?.teams ?? []) {
			championship.teams.push({
				...entry,
				event: event.code,
				eventName: event.name,
				region: event.region,
				date: event.end
			});
		}
	}

	for (const championship of destinations.values()) {
		championship.feeders.sort(byStart);
		const seen = new Set<number>();
		championship.teams = championship.teams
			.sort(
				(a, b) => a.date.localeCompare(b.date) || a.event.localeCompare(b.event) || a.slot - b.slot
			)
			.filter((team) => !seen.has(team.team) && seen.add(team.team));
	}

	const championships = [...destinations.values()]
		.filter((championship) => championship.feeders.length > 0 || championship.teams.length > 0)
		.sort((a, b) => (a.level === b.level ? byStart(a, b) : a.level === 'regional' ? -1 : 1));

	return { generatedAt: now, championships, unassigned: unassigned.sort(byStart) };
}

export function regionOptions(index: AdvancementIndex): RegionOption[] {
	const codes = new Set<string>();
	for (const championship of index.championships) {
		if (championship.level === 'regional' && championship.region) codes.add(championship.region);
		for (const feeder of championship.feeders) if (feeder.region) codes.add(feeder.region);
	}
	for (const feeder of index.unassigned) if (feeder.region) codes.add(feeder.region);
	return [...codes]
		.map((code) => ({ value: code, label: regionName(code) }))
		.sort((a, b) => a.label.localeCompare(b.label));
}

export function forRegion(championship: Championship, region: string): Championship {
	return {
		...championship,
		teams: championship.teams.filter((team) => team.region === region),
		feeders: championship.feeders.filter((feeder) => feeder.region === region)
	};
}

export function filterIndex(index: AdvancementIndex, region: string | null): AdvancementIndex {
	if (!region) return index;
	const championships = index.championships.flatMap((championship) => {
		if (championship.level === 'regional') {
			if (championship.region === region) return [championship];
			const local = forRegion(championship, region);
			return local.feeders.length > 0 ? [local] : [];
		}
		const local = forRegion(championship, region);
		return local.feeders.length > 0 || local.teams.length > 0 ? [local] : [];
	});
	return {
		...index,
		championships,
		unassigned: index.unassigned.filter((feeder) => feeder.region === region)
	};
}

export interface ChampionshipRow {
	code: string;
	name: string;
	level: ChampionshipLevel;
	type: EventType | null;
	place: string | null;
	start: string | null;
	end: string | null;
	advanced: number;
	teams: number[];
	played: number;
	feeders: number;
	pending: number;
	unposted: number;
	next: { code: string; name: string; start: string } | null;
}

export function isAhead(feeder: Feeder): boolean {
	return feeder.state === 'upcoming' || feeder.state === 'live';
}

export function unpostedIn(index: AdvancementIndex, championship: Championship): number {
	if (championship.level !== 'regional' || !championship.region) return 0;
	return index.unassigned.filter(
		(feeder) => feeder.region === championship.region && isAhead(feeder)
	).length;
}

export function championshipRow(championship: Championship, unposted = 0): ChampionshipRow {
	const ahead = championship.feeders.filter(isAhead);
	const next = ahead[0] ?? null;
	return {
		code: championship.code,
		name: championship.name,
		level: championship.level,
		type: championship.type,
		place: championship.place,
		start: championship.start,
		end: championship.end,
		advanced: championship.teams.length,
		teams: championship.teams.map((team) => team.team),
		played: championship.feeders.length - ahead.length,
		feeders: championship.feeders.length,
		pending: championship.feeders.filter((feeder) => feeder.state === 'pending').length,
		unposted,
		next: next ? { code: next.code, name: next.name, start: next.start } : null
	};
}

export function parseRegion(value: string | null): string | null {
	const code = value?.trim().toUpperCase() ?? '';
	return /^[A-Z0-9]{2,12}$/.test(code) ? code : null;
}
