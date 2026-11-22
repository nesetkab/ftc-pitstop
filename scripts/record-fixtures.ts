import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { createFtcClient, FtcApiError } from '../src/lib/server/ftc/client.ts';
import {
	createFtcScoutClient,
	fetchEventByCode,
	fetchEventsOnDate,
	fetchQuickStats,
	fetchSeasonMatches,
	fetchTeamSeason
} from '../src/lib/server/ftcscout.ts';

const EVENTS: Record<string, string> = {
	USAZGIQ: 'finished qualifier with 6 alliances and a surrogate',
	USMTBUQ: 'upcoming qualifier with no schedule yet',
	USFLORM1: 'league meet with surrogates and a no-show',
	USCALACAS1: 'non-advancement scrimmage without playoffs',
	KZASN2: 'non-advancement scrimmage with 2 alliances and surrogates',
	USALATQ: 'qualifier with 2 alliances',
	UZTAQ1: 'qualifier with 4 alliances, many no-shows and surrogates',
	USMISOQ: 'qualifier with 6 alliances and 11 playoff matches',
	USUTSAS1: 'scrimmage whose second alliance captain is placeholder team 99999',
	USMIWMM8: 'league meet whose rankings cover the whole league, 13 of 33 teams here',
	KZASQ1: 'qualifier recorded live on day 2 with day 1 matches carried over',
	USMINOQ: 'qualifier with a tied final and a tiebreaker replay',
	AUPYQ: 'finished qualifier with 6 alliances'
};

function endpoints(code: string): [string, string][] {
	return [
		['event', `events?eventCode=${code}`],
		['teams', `teams?eventCode=${code}`],
		['rankings', `rankings/${code}`],
		['schedule-qual', `schedule/${code}/qual/hybrid`],
		['schedule-playoff', `schedule/${code}/playoff/hybrid`],
		['matches-qual', `matches/${code}?tournamentLevel=qual`],
		['matches-playoff', `matches/${code}?tournamentLevel=playoff`],
		['scores-qual', `scores/${code}/qual`],
		['scores-playoff', `scores/${code}/playoff`],
		['alliances', `alliances/${code}`],
		['awards', `awards/${code}`],
		['advancement', `advancement/${code}`]
	];
}

const ftcRoot = fileURLToPath(new URL('../tests/fixtures/ftc/2026/', import.meta.url));
const scoutRoot = fileURLToPath(new URL('../tests/data/ftcscout/', import.meta.url));

async function save(dir: string, name: string, value: unknown) {
	await mkdir(dir, { recursive: true });
	const file = `${dir}${name}.json`;
	const config = await prettier.resolveConfig(file);
	await writeFile(
		file,
		await prettier.format(JSON.stringify(value), { ...config, filepath: file })
	);
}

async function recordFtc(code: string) {
	const client = createFtcClient({
		username: process.env.FTC_USERNAME,
		apiKey: process.env.FTC_API_KEY
	});
	if (!client.configured) {
		throw new Error(
			'Set FTC_USERNAME and FTC_API_KEY, for example with node --env-file=.env.local'
		);
	}
	const dir = `${ftcRoot}${code}/`;
	const meta: Record<string, { path: string; status: number; lastModified: string | null }> = {};
	for (const [name, path] of endpoints(code)) {
		try {
			const response = await client.request(path);
			if (response.status === 'unchanged') continue;
			await save(dir, name, response.body);
			meta[name] = { path, status: 200, lastModified: response.lastModified };
			const pages = (response.body as { pageTotal?: number }).pageTotal ?? 1;
			for (let page = 2; page <= pages; page++) {
				const next = await client.request(`${path}&page=${page}`);
				if (next.status === 'ok') await save(dir, `${name}-${page}`, next.body);
			}
		} catch (error) {
			if (!(error instanceof FtcApiError)) throw error;
			meta[name] = { path, status: error.status, lastModified: null };
		}
	}
	await save(dir, '_meta', {
		code,
		note: EVENTS[code] ?? '',
		recordedAt: new Date().toISOString(),
		endpoints: meta
	});
	console.log(`${code}: ${Object.keys(meta).length} endpoints`);
}

async function recordScout() {
	let name = '';
	const scout = createFtcScoutClient({
		timeoutMs: 90_000,
		fetch: async (input, init) => {
			const response = await fetch(input, init);
			const body = await response.clone().json();
			await save(scoutRoot, name, body);
			return response;
		}
	});
	const jobs: [string, () => Promise<unknown>][] = [
		['event-USAZGIQ', () => fetchEventByCode('USAZGIQ', 2026, scout)],
		['event-USALATQ', () => fetchEventByCode('USALATQ', 2026, scout)],
		['team-2844', () => fetchTeamSeason(2844, 2026, scout)],
		['team-missing', () => fetchTeamSeason(999998, 2026, scout)],
		['events-on-2026-11-14', () => fetchEventsOnDate('2026-11-14', scout)],
		['quick-stats-2025', () => fetchQuickStats([2844, 18420, 26670, 999998], 2025, scout)],
		[
			'season-matches-2026-09-19',
			() => fetchSeasonMatches({ start: '2026-09-19', end: '2026-09-20' }, scout)
		]
	];
	for (const [file, job] of jobs) {
		name = file;
		await job();
		console.log(`ftcscout: ${file}`);
	}
}

const args = process.argv.slice(2);
if (args.includes('--ftcscout')) {
	await recordScout();
} else {
	const codes = args.map((code) => code.toUpperCase());
	for (const code of codes.length > 0 ? codes : Object.keys(EVENTS)) await recordFtc(code);
}
