import type { SeasonRatings } from '#lib/analysis/types.ts';
import type { SearchTeam } from '#lib/types.ts';
import { stateName } from '#lib/format/places.ts';
import { ratedTeams } from './team-view.ts';

export const PAGE_SIZE = 50;

export const MIN_MATCH_CHOICES = [5, 10, 15, 20, 30];

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
	page: number;
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
const NAME = /^[\p{L}\p{M}0-9 .,'()&/-]{1,60}$/u;

function pick(value: string | null, pattern: RegExp): string {
	const text = value?.trim() ?? '';
	return pattern.test(text) ? text : '';
}

function whole(value: string | null, fallback: number, low: number, high: number): number {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) ? Math.min(Math.max(parsed, low), high) : fallback;
}

export function parseFilters(params: URLSearchParams): LeaderboardFilters {
	return {
		region: pick(params.get('region'), CODE).toUpperCase(),
		country: pick(params.get('country'), NAME),
		state: pick(params.get('state'), NAME),
		min: whole(params.get('min'), 0, 0, 200),
		page: whole(params.get('page'), 1, 1, 10_000)
	};
}

export function queryString(filters: LeaderboardFilters, page = filters.page): string {
	const params = new URLSearchParams();
	if (filters.region) params.set('region', filters.region);
	if (filters.country) params.set('country', filters.country);
	if (filters.state) params.set('state', filters.state);
	if (filters.min > 1) params.set('min', String(filters.min));
	if (page > 1) params.set('page', String(page));
	const text = params.toString();
	return text ? `?${text}` : '';
}

export function filterRows(rows: LeaderboardRow[], filters: LeaderboardFilters): LeaderboardRow[] {
	const min = Math.max(filters.min, 1);
	return rows.filter(
		(row) =>
			row.matches >= min &&
			(!filters.region || row.region === filters.region) &&
			(!filters.country || row.country === filters.country) &&
			(!filters.state || row.state === filters.state)
	);
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

export function createDataset(rows: LeaderboardRow[]): LeaderboardDataset {
	const sorted = [...rows].sort((a, b) => b.opr - a.opr || a.team - b.team);
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
		regions: [...regions].map((value) => ({ value, label: value })).sort(byLabel),
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
