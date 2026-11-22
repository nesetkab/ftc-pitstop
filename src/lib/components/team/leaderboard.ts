import {
	EVENT_RATING_STRIDE,
	type SeasonEventRatings,
	type SeasonRatings
} from '#lib/analysis/types.ts';
import { addDays, shortRange, weekStart } from '#lib/components/event/dates.ts';
import { shortDate } from '#lib/format/time.ts';
import { EVENT_TYPE_NAMES, isCompetition } from '#lib/game/event-types.ts';
import type { EventSummary, EventType, SearchTeam } from '#lib/types.ts';
import { regionName, stateName } from '#lib/format/places.ts';
import { ratedTeams } from './team-view.ts';

export const PAGE_SIZE = 50;

export const MIN_MATCH_CHOICES = [5, 10, 15, 20, 30];

export const LEADERBOARD_SORTS = [
	{ key: 'opr', label: 'OPR' },
	{ key: 'auto', label: 'Auto' },
	{ key: 'teleop', label: 'Teleop' },
	{ key: 'tips', label: 'Tips' },
	{ key: 'matches', label: 'Matches' }
] as const;

export type LeaderboardSort = (typeof LEADERBOARD_SORTS)[number]['key'];

export const RECENT_DAYS = 14;

const TYPE_ORDER: EventType[] = [
	'Scrimmage',
	'LeagueMeet',
	'Qualifier',
	'LeagueTournament',
	'SuperQualifier',
	'Championship',
	'Premier',
	'FIRSTChampionship',
	'InnovationChallenge',
	'NonAdvancement',
	'OffSeason',
	'Pilot',
	'Other'
];

const OFFICIAL: ReadonlySet<EventType> = new Set([
	'LeagueMeet',
	'Qualifier',
	'LeagueTournament',
	'SuperQualifier',
	'Championship',
	'Premier',
	'FIRSTChampionship'
]);

export interface LeaderboardRow {
	team: number;
	name: string | null;
	city: string | null;
	state: string | null;
	country: string | null;
	region: string | null;
	opr: number;
	auto: number;
	teleop: number;
	tips: number | null;
	matches: number;
	events: number | null;
}

export interface LeaderboardFilters {
	region: string;
	country: string;
	state: string;
	min: number;
	sort: LeaderboardSort;
	q: string;
	team: number;
	page: number;
	type: string;
	dates: '' | 'recent';
	from: string;
	to: string;
}

export interface DateWindow {
	from: string;
	to: string;
}

export interface LeaderboardScope {
	type: string;
	window: DateWindow | null;
}

export interface EventFilterOptions {
	types: FilterOption[];
	weeks: FilterOption[];
}

export interface FilterOption {
	value: string;
	label: string;
}

export interface LeaderboardDataset {
	rows: LeaderboardRow[];
	regions: FilterOption[];
	countries: FilterOption[];
	states: Record<string, FilterOption[]>;
}

export interface LeaderboardPage {
	rows: LeaderboardRow[];
	total: number;
	page: number;
	pages: number;
	start: number;
}

const CODE = /^[A-Za-z0-9]{1,12}$/;
const QUERY_LENGTH = 40;
const NAME = /^[\p{L}\p{M}0-9 .,'()&/-]{1,60}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function day(value: string | null): string {
	const text = value?.trim() ?? '';
	if (!DATE.test(text)) return '';
	const parsed = new Date(`${text}T00:00:00Z`);
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(text) ? text : '';
}

function eventType(value: string | null): string {
	if (value === 'official') return value;
	return value && Object.hasOwn(EVENT_TYPE_NAMES, value) ? value : '';
}

function pick(value: string | null, pattern: RegExp): string {
	const text = value?.trim() ?? '';
	return pattern.test(text) ? text : '';
}

function whole(value: string | null, fallback: number, low: number, high: number): number {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) ? Math.min(Math.max(parsed, low), high) : fallback;
}

function isSort(value: string | null): value is LeaderboardSort {
	return LEADERBOARD_SORTS.some((sort) => sort.key === value);
}

export function normalizeText(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

export function parseFilters(params: URLSearchParams): LeaderboardFilters {
	const sort = params.get('sort');
	const recent = params.get('dates') === 'recent';
	let from = recent ? '' : day(params.get('from'));
	let to = recent ? '' : day(params.get('to'));
	if (from && to && from > to) [from, to] = [to, from];
	return {
		region: pick(params.get('region'), CODE).toUpperCase(),
		country: pick(params.get('country'), NAME),
		state: pick(params.get('state'), NAME),
		min: whole(params.get('min'), 0, 0, 200),
		sort: isSort(sort) ? sort : 'opr',
		q: (params.get('q') ?? '').trim().slice(0, QUERY_LENGTH),
		team: whole(params.get('team'), 0, 0, 999_999),
		page: whole(params.get('page'), 1, 1, 10_000),
		type: eventType(params.get('type')),
		dates: recent ? 'recent' : '',
		from,
		to
	};
}

export function queryString(filters: LeaderboardFilters, page = filters.page): string {
	const params = new URLSearchParams();
	if (filters.region) params.set('region', filters.region);
	if (filters.country) params.set('country', filters.country);
	if (filters.state) params.set('state', filters.state);
	if (filters.type) params.set('type', filters.type);
	if (filters.dates) params.set('dates', filters.dates);
	if (filters.from) params.set('from', filters.from);
	if (filters.to) params.set('to', filters.to);
	if (filters.min > 1) params.set('min', String(filters.min));
	if (filters.sort !== 'opr') params.set('sort', filters.sort);
	if (filters.q) params.set('q', filters.q);
	if (filters.team > 0) params.set('team', String(filters.team));
	if (page > 1) params.set('page', String(page));
	const text = params.toString();
	return text ? `?${text}` : '';
}

export function matchesQuery(row: LeaderboardRow, query: string): boolean {
	const needle = normalizeText(query);
	if (!needle) return true;
	if (/^\d+$/.test(needle)) return String(row.team).startsWith(needle);
	const haystack = normalizeText([row.name, row.city, row.state].filter(Boolean).join(' '));
	return ` ${haystack}`.includes(` ${needle}`);
}

export function sortRows(rows: LeaderboardRow[], sort: LeaderboardSort): LeaderboardRow[] {
	if (sort === 'opr') return rows;
	const value = (row: LeaderboardRow) => row[sort] ?? Number.NEGATIVE_INFINITY;
	return [...rows].sort((a, b) => value(b) - value(a) || b.opr - a.opr || a.team - b.team);
}

export function filterRows(rows: LeaderboardRow[], filters: LeaderboardFilters): LeaderboardRow[] {
	const min = Math.max(filters.min, 1);
	const filtered = rows.filter(
		(row) =>
			row.matches >= min &&
			(!filters.region || row.region === filters.region) &&
			(!filters.country || row.country === filters.country) &&
			(!filters.state || row.state === filters.state) &&
			matchesQuery(row, filters.q)
	);
	return sortRows(filtered, filters.sort);
}

export function teamPage(rows: LeaderboardRow[], team: number, size = PAGE_SIZE): number | null {
	const index = rows.findIndex((row) => row.team === team);
	return index < 0 ? null : Math.floor(index / size) + 1;
}

export function paginate(rows: LeaderboardRow[], page: number, size = PAGE_SIZE): LeaderboardPage {
	const pages = Math.max(1, Math.ceil(rows.length / size));
	const current = Math.min(Math.max(page, 1), pages);
	const start = (current - 1) * size;
	return {
		rows: rows.slice(start, start + size),
		total: rows.length,
		page: current,
		pages,
		start
	};
}

function byLabel(a: FilterOption, b: FilterOption): number {
	return a.label.localeCompare(b.label, 'en', { numeric: true });
}

function byOpr(a: LeaderboardRow, b: LeaderboardRow): number {
	return b.opr - a.opr || a.team - b.team;
}

export function createDataset(rows: LeaderboardRow[]): LeaderboardDataset {
	const sorted = [...rows].sort(byOpr);
	const regions = new Set<string>();
	const countries = new Set<string>();
	const states = new Map<string, Set<string>>();
	for (const row of sorted) {
		if (row.region) regions.add(row.region);
		if (!row.country) continue;
		countries.add(row.country);
		if (row.state) {
			const inCountry = states.get(row.country) ?? new Set<string>();
			inCountry.add(row.state);
			states.set(row.country, inCountry);
		}
	}
	return {
		rows: sorted,
		regions: [...regions].map((value) => ({ value, label: regionName(value) })).sort(byLabel),
		countries: [...countries].map((value) => ({ value, label: value })).sort(byLabel),
		states: Object.fromEntries(
			[...states].map(([country, values]) => [
				country,
				[...values]
					.map((value) => ({ value, label: stateName(value, country) ?? value }))
					.sort(byLabel)
			])
		)
	};
}

export function buildRatingRows(ratings: SeasonRatings, directory: SearchTeam[]): LeaderboardRow[] {
	const teams = new Map(directory.map((team) => [team.number, team]));
	return ratedTeams(ratings).map((entry) => {
		const team = teams.get(entry.team);
		return {
			team: entry.team,
			name: team?.name ?? null,
			city: team?.city ?? null,
			state: team?.state ?? null,
			country: team?.country ?? null,
			region: entry.region,
			opr: entry.opr,
			auto: entry.parts.auto,
			teleop: entry.opr - entry.parts.auto,
			tips: entry.parts.tips,
			matches: entry.matches,
			events: entry.events
		};
	});
}

export function dateWindow(filters: LeaderboardFilters, today: string): DateWindow | null {
	if (filters.dates === 'recent') return { from: addDays(today, 1 - RECENT_DAYS), to: today };
	if (!filters.from && !filters.to) return null;
	return { from: filters.from || '0000-01-01', to: filters.to || '9999-12-31' };
}

export function leaderboardScope(filters: LeaderboardFilters, today: string): LeaderboardScope {
	return { type: filters.type, window: dateWindow(filters, today) };
}

export function isScoped(scope: LeaderboardScope): boolean {
	return scope.type !== '' || scope.window !== null;
}

export function matchesType(type: EventType, filter: string): boolean {
	if (!filter) return true;
	return filter === 'official' ? OFFICIAL.has(type) : type === filter;
}

export function typeLabel(filter: string): string {
	if (filter === 'official') return 'Official events';
	return Object.hasOwn(EVENT_TYPE_NAMES, filter)
		? `${EVENT_TYPE_NAMES[filter as EventType]} events`
		: 'All events';
}

export function windowLabel(window: DateWindow | null, recent = false): string {
	if (!window) return '';
	if (recent) return `last ${RECENT_DAYS / 7} weeks`;
	const open = window.from.startsWith('0000');
	const endless = window.to.startsWith('9999');
	if (open && endless) return '';
	if (open) return `through ${shortDate(window.to)}`;
	if (endless) return `since ${shortDate(window.from)}`;
	return shortRange(window.from, window.to);
}

export function datesChoice(filters: LeaderboardFilters, weeks: FilterOption[]): string {
	if (filters.dates === 'recent') return 'recent';
	if (!filters.from && !filters.to) return '';
	const week = filters.from && filters.to === addDays(filters.from, 6);
	return week && weeks.some((option) => option.value === filters.from) ? filters.from : 'custom';
}

export function eventFilterOptions(
	events: Pick<EventSummary, 'type' | 'start' | 'hasMatches'>[],
	today: string
): EventFilterOptions {
	const types = new Set<EventType>();
	const weeks = new Set<string>();
	for (const event of events) {
		if (event.start > today || event.hasMatches === false || !isCompetition(event.type)) continue;
		types.add(event.type);
		weeks.add(weekStart(event.start));
	}
	const ordered = TYPE_ORDER.filter((type) => types.has(type));
	const official = ordered.length > 1 && ordered.some((type) => OFFICIAL.has(type));
	return {
		types: [
			...(official ? [{ value: 'official', label: typeLabel('official') }] : []),
			...ordered.map((type) => ({ value: type, label: EVENT_TYPE_NAMES[type] }))
		],
		weeks: [...weeks]
			.sort((a, b) => b.localeCompare(a))
			.map((start) => ({ value: start, label: shortRange(start, addDays(start, 6)) }))
	};
}

export function scopeRows(
	rows: LeaderboardRow[],
	table: SeasonEventRatings,
	scope: LeaderboardScope
): LeaderboardRow[] {
	const latest = new Map<
		number,
		{ opr: number; auto: number; tips: number; matches: number; events: number }
	>();
	const { window } = scope;
	for (const event of table.events) {
		if (!matchesType(event.type, scope.type)) continue;
		if (window && (event.start < window.from || event.start > window.to)) continue;
		const teams = event.teams;
		for (let i = 0; i < teams.length; i += EVENT_RATING_STRIDE) {
			const seen = latest.get(teams[i]);
			latest.set(teams[i], {
				opr: teams[i + 1],
				auto: teams[i + 2],
				tips: teams[i + 3],
				matches: (seen?.matches ?? 0) + teams[i + 4],
				events: (seen?.events ?? 0) + 1
			});
		}
	}
	return rows
		.flatMap((row) => {
			const rated = latest.get(row.team);
			if (!rated) return [];
			return [
				{
					...row,
					opr: rated.opr,
					auto: rated.auto,
					teleop: rated.opr - rated.auto,
					tips: rated.tips,
					matches: rated.matches,
					events: rated.events
				}
			];
		})
		.sort(byOpr);
}
