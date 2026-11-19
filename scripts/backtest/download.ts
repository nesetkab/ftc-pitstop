import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { HistEvent, HistMatch, HistSeason, HistTeam } from './hist.ts';

const API = 'https://api.ftcscout.org/graphql';
const USER_AGENT = 'pitstop-backtest/1.0 (+https://ftcpitstop.com)';
const ROOT = join(import.meta.dirname, '..', '..', '.cache', 'hist');
const ALL_SEASONS = [2021, 2022, 2023, 2024, 2025, 2026];
const CURRENT_SEASON = 2026;
const WINDOW_EVENTS = 60;
const WINDOW_DAYS = 7;
const PAUSE_MS = 400;
const STALE_MS = 6 * 60 * 60 * 1000;
const BASE_FIELDS = [
	'totalPoints',
	'totalPointsNp',
	'autoPoints',
	'dcPoints',
	'egPoints',
	'penaltyPointsCommitted',
	'penaltyPointsByOpp'
];

type EventListItem = {
	code: string;
	name: string;
	type: string;
	start: string;
	end: string;
	remote: boolean;
	timezone: string;
	regionCode: string | null;
	divisionCode: string | null;
	leagueCode: string | null;
	finished: boolean;
};

type RawTeam = {
	teamNumber: number;
	alliance: string;
	station: string;
	surrogate: boolean;
	noShow: boolean;
	dq: boolean;
	onField: boolean;
};

type RawMatch = {
	id: number;
	tournamentLevel: string;
	series: number;
	matchNum: number;
	hasBeenPlayed: boolean;
	scheduledStartTime: string | null;
	actualStartTime: string | null;
	postResultTime: string | null;
	teams: RawTeam[];
	scores: { red?: Record<string, number | boolean>; blue?: Record<string, number | boolean> } | null;
};

type RawEvent = { code: string; matches: RawMatch[] };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function gql<T>(name: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 5; attempt++) {
		if (attempt > 0) await sleep(2000 * 2 ** attempt);
		try {
			const res = await fetch(API, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
				body: JSON.stringify({ operationName: name, query, variables }),
				signal: AbortSignal.timeout(120_000)
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
			if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
			if (!body.data) throw new Error('empty response');
			await sleep(PAUSE_MS);
			return body.data;
		} catch (error) {
			lastError = error;
			console.warn(`  ${name} failed (attempt ${attempt + 1}): ${String(error)}`);
		}
	}
	throw lastError;
}

async function readJson<T>(path: string): Promise<T | null> {
	try {
		return JSON.parse(await readFile(path, 'utf8')) as T;
	} catch {
		return null;
	}
}

async function ageMs(path: string): Promise<number> {
	try {
		return Date.now() - (await stat(path)).mtimeMs;
	} catch {
		return Infinity;
	}
}

function allianceType(season: number): string {
	return `MatchScores${season}Alliance`;
}

function scoresType(season: number): string {
	return season === 2021 ? 'MatchScores2021Trad' : `MatchScores${season}`;
}

type IntrospectedField = { name: string; type: { kind: string; name: string | null; ofType: { name: string | null } | null } };

async function scoreFields(season: number): Promise<string[]> {
	const data = await gql<{ __type: { fields: IntrospectedField[] } | null }>(
		'AllianceFields',
		'query AllianceFields($name: String!) { __type(name: $name) { fields { name type { kind name ofType { name } } } } }',
		{ name: allianceType(season) }
	);
	if (!data.__type) throw new Error(`no type ${allianceType(season)}`);
	const scalar = data.__type.fields
		.filter((f) => {
			const base = f.type.kind === 'NON_NULL' ? f.type.ofType?.name : f.type.name;
			return base === 'Int' || base === 'Boolean';
		})
		.map((f) => f.name)
		.filter((f) => !['season', 'matchId'].includes(f));
	if (season === CURRENT_SEASON) return scalar;
	return BASE_FIELDS.filter((f) => scalar.includes(f));
}

async function eventList(season: number, refresh: boolean): Promise<EventListItem[]> {
	const path = join(ROOT, String(season), 'events.json');
	const cached = await readJson<EventListItem[]>(path);
	const stale = season === CURRENT_SEASON && (refresh || (await ageMs(path)) > STALE_MS);
	if (cached && !stale) return cached;
	const data = await gql<{ eventsSearch: EventListItem[] }>(
		'EventsSearch',
		`query EventsSearch($season: Int!) { eventsSearch(season: $season, hasMatches: true) {
			code name type start end remote timezone regionCode divisionCode leagueCode finished } }`,
		{ season }
	);
	await writeFile(path, JSON.stringify(data.eventsSearch));
	return data.eventsSearch;
}

function matchSelection(season: number, fields: string[]): string {
	const alliance = fields.join(' ');
	return `matches { id tournamentLevel series matchNum hasBeenPlayed scheduledStartTime actualStartTime postResultTime
		teams { teamNumber alliance station surrogate noShow dq onField }
		scores { ... on ${scoresType(season)} { red { ${alliance} } blue { ${alliance} } } } }`;
}

function addDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
	return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function windows(events: EventListItem[]): EventListItem[][] {
	const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start) || a.code.localeCompare(b.code));
	const out: EventListItem[][] = [];
	let current: EventListItem[] = [];
	for (const event of sorted) {
		const first = current[0];
		const full = current.length >= WINDOW_EVENTS && current[current.length - 1].start !== event.start;
		if (first && (full || dayDiff(first.start, event.start) >= WINDOW_DAYS)) {
			out.push(current);
			current = [];
		}
		current.push(event);
	}
	if (current.length) out.push(current);
	return out;
}

async function fetchWindow(
	season: number,
	group: EventListItem[],
	fields: string[],
	refresh: boolean
): Promise<Map<string, RawEvent>> {
	const start = group[0].start;
	const end = group[group.length - 1].start;
	const path = join(ROOT, String(season), `w_${start}_${end}.json`);
	const wanted = new Set(group.map((e) => e.code));
	const unfinished = group.some((e) => !e.finished);
	const cached = await readJson<RawEvent[]>(path);
	const fresh = cached && !(unfinished && (refresh || (await ageMs(path)) > STALE_MS));
	let events: RawEvent[];
	if (cached && fresh && group.every((e) => cached.some((c) => c.code === e.code))) {
		events = cached;
	} else {
		const maxEnd = group.reduce((m, e) => (e.end > m ? e.end : m), end);
		const data = await gql<{ eventsSearch: RawEvent[] }>(
			'EventsSearch',
			`query EventsSearch($season: Int!, $start: Date!, $end: Date!) {
				eventsSearch(season: $season, start: $start, end: $end, hasMatches: true) { code ${matchSelection(season, fields)} } }`,
			{ season, start, end: addDays(maxEnd, 1) }
		);
		events = data.eventsSearch.filter((e) => wanted.has(e.code));
		const missing = group.filter((e) => !events.some((x) => x.code === e.code));
		for (const event of missing) {
			const one = await gql<{ eventByCode: RawEvent | null }>(
				'EventByCode',
				`query EventByCode($season: Int!, $code: String!) { eventByCode(season: $season, code: $code) { code ${matchSelection(season, fields)} } }`,
				{ season, code: event.code }
			);
			if (one.eventByCode) events.push(one.eventByCode);
		}
		await writeFile(path, JSON.stringify(events));
		console.log(`  ${season} ${start}..${end}: ${events.length} events, ${missing.length} fetched one by one`);
	}
	return new Map(events.map((e) => [e.code, e]));
}

function compactScores(raw: Record<string, number | boolean> | undefined): Record<string, number> | null {
	if (!raw) return null;
	const out: Record<string, number> = {};
	for (const [key, value] of Object.entries(raw)) {
		if (typeof value === 'number') out[key] = value;
		else if (typeof value === 'boolean') out[key] = value ? 1 : 0;
	}
	return out;
}

function compactTeam(t: RawTeam): HistTeam {
	const team: HistTeam = { n: t.teamNumber };
	if (t.station === 'One') team.s = 1;
	if (t.station === 'Two') team.s = 2;
	if (t.surrogate) team.sur = 1;
	if (t.noShow) team.ns = 1;
	if (t.dq) team.dq = 1;
	if (!t.onField || t.station === 'NotOnField') team.off = 1;
	return team;
}

function compactMatch(m: RawMatch): HistMatch {
	return {
		id: m.id,
		level: m.tournamentLevel,
		series: m.series,
		num: m.matchNum,
		played: m.hasBeenPlayed,
		sched: m.scheduledStartTime,
		actual: m.actualStartTime,
		post: m.postResultTime,
		red: m.teams.filter((t) => t.alliance === 'Red').map(compactTeam),
		blue: m.teams.filter((t) => t.alliance === 'Blue').map(compactTeam),
		rs: compactScores(m.scores?.red),
		bs: compactScores(m.scores?.blue)
	};
}

async function downloadSeason(season: number, refresh: boolean): Promise<void> {
	await mkdir(join(ROOT, String(season)), { recursive: true });
	const fields = await scoreFields(season);
	const list = (await eventList(season, refresh)).filter((e) => !e.remote);
	console.log(`${season}: ${list.length} traditional events with matches, fields ${fields.join(',')}`);
	const raw = new Map<string, RawEvent>();
	for (const group of windows(list)) {
		for (const [code, event] of await fetchWindow(season, group, fields, refresh)) raw.set(code, event);
	}
	const events: HistEvent[] = list
		.map((e) => ({
			season,
			code: e.code,
			name: e.name,
			type: e.type,
			start: e.start,
			end: e.end,
			timezone: e.timezone,
			region: e.regionCode,
			division: e.divisionCode,
			league: e.leagueCode,
			finished: e.finished,
			matches: (raw.get(e.code)?.matches ?? []).map(compactMatch).sort((a, b) => a.id - b.id)
		}))
		.filter((e) => e.matches.length > 0)
		.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.code.localeCompare(b.code));
	const out: HistSeason = { season, fetchedAt: new Date().toISOString(), fields, events };
	await writeFile(join(ROOT, `${season}.json`), JSON.stringify(out));
	const matches = events.reduce((n, e) => n + e.matches.length, 0);
	console.log(`${season}: wrote ${events.length} events, ${matches} matches`);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const refresh = args.includes('--refresh');
	const picked = args.filter((a) => /^\d{4}$/.test(a)).map(Number);
	await mkdir(ROOT, { recursive: true });
	for (const season of picked.length ? picked : ALL_SEASONS) await downloadSeason(season, refresh);
}

await main();
