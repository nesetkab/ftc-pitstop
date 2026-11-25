import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.ftcscout.org/graphql';
const USER_AGENT = 'pitstop-backtest/1.0 (+https://ftcpitstop.com)';
export const ROBOT_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '.cache', 'robot');
const WINDOW_EVENTS = 60;
const WINDOW_DAYS = 7;
const PAUSE_MS = 400;

export const ROBOT_FIELDS: Record<number, string[]> = {
	2021: [
		'autoNav2021_1',
		'autoNav2021_2',
		'autoBonus1',
		'autoBonus2',
		'barcodeElement1',
		'barcodeElement2',
		'egPark1',
		'egPark2',
		'autoNavPoints',
		'autoBonusPoints',
		'egParkPoints'
	],
	2022: ['autoNav2022_1', 'autoNav2022_2', 'egNav1', 'egNav2', 'autoNavPoints', 'egNavPoints'],
	2023: [
		'autoNav1',
		'autoNav2',
		'purple1',
		'purple2',
		'yellow1',
		'yellow2',
		'egNav2023_1',
		'egNav2023_2',
		'drone1',
		'drone2',
		'autoNavPoints',
		'purplePoints',
		'yellowPoints',
		'egNavPoints',
		'dronePoints'
	],
	2024: ['autoPark1', 'autoPark2', 'dcPark1', 'dcPark2', 'autoParkPoints', 'dcParkPoints'],
	2025: [
		'autoLeave1',
		'autoLeave2',
		'dcBase1',
		'dcBase2',
		'dcBaseBonus',
		'autoLeavePoints',
		'dcBasePoints'
	]
};

type EventItem = { code: string; start: string; end: string; remote: boolean };
type RawMatch = {
	id: number;
	scores: { red?: Record<string, unknown>; blue?: Record<string, unknown> } | null;
};
type RawEvent = { code: string; matches: RawMatch[] };
export type RobotRaw = Record<string, unknown>;
export type RobotSeason = Record<string, [RobotRaw, RobotRaw]>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 5; attempt++) {
		if (attempt > 0) await sleep(2000 * 2 ** attempt);
		try {
			const res = await fetch(API, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
				body: JSON.stringify({ query, variables }),
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
			console.warn(`  failed (attempt ${attempt + 1}): ${String(error)}`);
		}
	}
	throw lastError;
}

const addDays = (date: string, days: number) => {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
};

const dayDiff = (a: string, b: string) =>
	Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function windows(events: EventItem[]): EventItem[][] {
	const sorted = [...events].sort(
		(a, b) => a.start.localeCompare(b.start) || a.code.localeCompare(b.code)
	);
	const out: EventItem[][] = [];
	let current: EventItem[] = [];
	for (const event of sorted) {
		const first = current[0];
		const full =
			current.length >= WINDOW_EVENTS && current[current.length - 1].start !== event.start;
		if (first && (full || dayDiff(first.start, event.start) >= WINDOW_DAYS)) {
			out.push(current);
			current = [];
		}
		current.push(event);
	}
	if (current.length) out.push(current);
	return out;
}

async function season(s: number): Promise<void> {
	const path = join(ROBOT_ROOT, `${s}.json`);
	if (existsSync(path)) return;
	const type = s === 2021 ? 'MatchScores2021Trad' : `MatchScores${s}`;
	const f = ROBOT_FIELDS[s].join(' ');
	const sel = `code matches { id scores { ... on ${type} { red { ${f} } blue { ${f} } } } }`;
	const list = (
		await gql<{ eventsSearch: EventItem[] }>(
			`query E($season: Int!) { eventsSearch(season: $season, hasMatches: true) { code start end remote } }`,
			{ season: s }
		)
	).eventsSearch.filter((e) => !e.remote);
	const out: RobotSeason = {};
	for (const group of windows(list)) {
		const wanted = new Set(group.map((e) => e.code));
		const maxEnd = group.reduce((m, e) => (e.end > m ? e.end : m), group[group.length - 1].start);
		const data = await gql<{ eventsSearch: RawEvent[] }>(
			`query W($season: Int!, $start: Date!, $end: Date!) { eventsSearch(season: $season, start: $start, end: $end, hasMatches: true) { ${sel} } }`,
			{ season: s, start: group[0].start, end: addDays(maxEnd, 1) }
		);
		const events = data.eventsSearch.filter((e) => wanted.has(e.code));
		for (const e of group.filter((g) => !events.some((x) => x.code === g.code))) {
			const one = await gql<{ eventByCode: RawEvent | null }>(
				`query O($season: Int!, $code: String!) { eventByCode(season: $season, code: $code) { ${sel} } }`,
				{ season: s, code: e.code }
			);
			if (one.eventByCode) events.push(one.eventByCode);
		}
		for (const e of events) {
			for (const m of e.matches) {
				if (m.scores?.red && m.scores.blue)
					out[`${e.code}:${m.id}`] = [m.scores.red, m.scores.blue];
			}
		}
		console.log(
			`  ${s} ${group[0].start}: ${events.length} events, total ${Object.keys(out).length}`
		);
	}
	await writeFile(path, JSON.stringify(out));
	console.log(`${s}: ${Object.keys(out).length} matches`);
}

await mkdir(ROBOT_ROOT, { recursive: true });
const picked = process.argv.slice(2).map(Number).filter(Boolean);
for (const s of picked.length ? picked : [2021, 2022, 2023, 2024, 2025]) await season(s);
