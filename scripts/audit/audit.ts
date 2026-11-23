import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as prettier from 'prettier';
import { fileURLToPath } from 'node:url';
import { createFtcClient } from '../../src/lib/server/ftc/client.ts';
import { scoutMatchKey } from '../../src/lib/server/ftcscout.ts';
import { eventRecordRows, partAverages } from '../../src/lib/components/event/insights.ts';
import type { EventBundle, Match } from '../../src/lib/types.ts';
import type { EventAnalysis } from '../../src/lib/analysis/types.ts';
import { leastSquaresOpr, spearman, summarize } from './compare.ts';

const CODES = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const PITSTOP = process.env.PITSTOP_URL ?? 'http://localhost:5311';
const cacheRoot = fileURLToPath(new URL('../../.cache/audit/', import.meta.url));
const fresh = process.argv.includes('--fresh');
const snapshot = process.argv.includes('--snapshot');
const snapshotRoot = fileURLToPath(new URL('../../tests/data/ftcscout/', import.meta.url));

const SCOUT_QUERY = `query Audit($code: String!) {
	eventByCode(season: 2026, code: $code) {
		code name type
		teams { teamNumber stats { ... on TeamEventStats2026 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp totalPoints autoPoints } } } }
		matches {
			tournamentLevel series matchNum hasBeenPlayed
			teams { teamNumber alliance station surrogate noShow dq }
			scores { ... on MatchScores2026 {
				red { totalPoints totalPointsNp autoPoints dcPoints penaltyPointsByOpp autoLeavePoints autoParkPoints autoHivePoints dcHivePoints dcFlowerPoints dcGardenPoints dcParkPoints majorsCommitted minorsCommitted }
				blue { totalPoints totalPointsNp autoPoints dcPoints penaltyPointsByOpp autoLeavePoints autoParkPoints autoHivePoints dcHivePoints dcFlowerPoints dcGardenPoints dcParkPoints majorsCommitted minorsCommitted }
			} }
		}
		awards { type placement teamNumber }
	}
}`;

type ScoutAlliance = Record<string, number>;
type ScoutEvent = {
	code: string;
	teams: {
		teamNumber: number;
		stats: {
			rank: number;
			rp: number;
			tb1: number;
			tb2: number;
			wins: number;
			losses: number;
			ties: number;
			dqs: number;
			qualMatchesPlayed: number;
			opr: { totalPointsNp: number; totalPoints: number; autoPoints: number } | null;
		} | null;
	}[];
	matches: {
		tournamentLevel: string;
		series: number;
		matchNum: number;
		hasBeenPlayed: boolean;
		teams: { teamNumber: number; alliance: string; dq: boolean; noShow: boolean }[];
		scores: { red: ScoutAlliance; blue: ScoutAlliance } | null;
	}[];
	awards: { type: string; placement: number; teamNumber: number | null }[];
};

async function cached<T>(code: string, name: string, load: () => Promise<T>): Promise<T> {
	const file = `${cacheRoot}${code}/${name}.json`;
	const saved = fresh ? null : await readFile(file, 'utf8').catch(() => null);
	if (saved) return JSON.parse(saved) as T;
	const value = await load();
	await mkdir(`${cacheRoot}${code}`, { recursive: true });
	await writeFile(file, JSON.stringify(value));
	return value;
}

const ftc = createFtcClient({
	username: process.env.FTC_USERNAME,
	apiKey: process.env.FTC_API_KEY,
	timeoutMs: 20_000,
	budgetMs: 30_000
});

async function ftcRaw(code: string, path: string): Promise<unknown> {
	try {
		const response = await ftc.request(path);
		return response.status === 'ok' ? response.body : null;
	} catch {
		return null;
	}
}

async function scout(code: string): Promise<ScoutEvent | null> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const response = await fetch('https://api.ftcscout.org/graphql', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'user-agent': 'PitStop/1.0 audit' },
			body: JSON.stringify({ query: SCOUT_QUERY, variables: { code } })
		});
		if (response.ok && response.headers.get('content-type')?.includes('json')) {
			const body = (await response.json()) as { data: { eventByCode: ScoutEvent | null } };
			return body.data.eventByCode;
		}
		await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
	}
	throw new Error(`FTCScout unavailable for ${code}`);
}

async function pitstop<T>(path: string): Promise<T> {
	const response = await fetch(`${PITSTOP}${path}`);
	if (!response.ok) throw new Error(`${path}: ${response.status}`);
	return (await response.json()) as T;
}

type Check = { area: string; ok: boolean; checked: number; issues: string[] };

function check(area: string): Check {
	return { area, ok: true, checked: 0, issues: [] };
}

function flag(c: Check, issue: string) {
	c.ok = false;
	if (c.issues.length < 12) c.issues.push(issue);
}

type FtcRanking = {
	rank: number;
	teamNumber: number;
	sortOrder1: number;
	sortOrder2: number;
	wins: number;
	losses: number;
	ties: number;
	matchesPlayed: number;
	dq: number;
};

function rankings(bundle: EventBundle, raw: { rankings: FtcRanking[] } | null, s: ScoutEvent) {
	const c = check('rankings');
	const official = raw?.rankings ?? [];
	const scoutRanks = new Map(
		s.teams.filter((t) => t.stats && t.stats.rank > 0).map((t) => [t.teamNumber, t.stats!])
	);
	if (official.length !== bundle.rankings.length)
		flag(c, `row count FIRST ${official.length} vs PitStop ${bundle.rankings.length}`);
	for (const row of bundle.rankings) {
		c.checked++;
		const first = official.find((r) => r.teamNumber === row.team);
		const fs = scoutRanks.get(row.team);
		if (!first) flag(c, `${row.team} missing from FIRST rankings`);
		else {
			const diffs = [
				first.rank !== row.rank && `rank ${first.rank}/${row.rank}`,
				Math.abs(first.sortOrder1 - row.rs) > 1e-6 && `RS ${first.sortOrder1}/${row.rs}`,
				Math.abs(first.sortOrder2 - row.tbp) > 1e-6 && `TBP ${first.sortOrder2}/${row.tbp}`,
				(first.wins !== row.wins || first.losses !== row.losses || first.ties !== row.ties) &&
					`record ${first.wins}-${first.losses}-${first.ties}/${row.wins}-${row.losses}-${row.ties}`,
				first.matchesPlayed !== row.played && `played ${first.matchesPlayed}/${row.played}`
			].filter(Boolean);
			if (diffs.length) flag(c, `${row.team} FIRST/PitStop: ${diffs.join(', ')}`);
		}
		if (!fs) flag(c, `${row.team} missing from FTCScout rankings`);
		else {
			const diffs = [
				fs.rank !== row.rank && `rank ${fs.rank}/${row.rank}`,
				Math.abs(fs.rp - row.rs) > 0.01 && `RS ${fs.rp}/${row.rs}`,
				Math.abs(fs.tb1 - row.tbp) > 0.01 && `TBP ${fs.tb1}/${row.tbp}`,
				(fs.wins !== row.wins || fs.losses !== row.losses || fs.ties !== row.ties) &&
					`record ${fs.wins}-${fs.losses}-${fs.ties}/${row.wins}-${row.losses}-${row.ties}`,
				fs.qualMatchesPlayed !== row.played && `played ${fs.qualMatchesPlayed}/${row.played}`
			].filter(Boolean);
			if (diffs.length) flag(c, `${row.team} FTCScout/PitStop: ${diffs.join(', ')}`);
		}
	}
	return c;
}

const PART_KEYS: [string, (m: Match['result'] & object, side: 'red' | 'blue') => number | null][] =
	[
		['totalPoints', (r, side) => r[side].total],
		['totalPointsNp', (r, side) => r[side].preFoulTotal],
		['autoPoints', (r, side) => r[side].auto],
		['dcPoints', (r, side) => r[side].teleop],
		['penaltyPointsByOpp', (r, side) => r[side].foulPoints],
		['autoLeavePoints', (r, side) => r[side].breakdown?.points.autoLeave ?? null],
		['autoParkPoints', (r, side) => r[side].breakdown?.points.autoPark ?? null],
		['autoHivePoints', (r, side) => r[side].breakdown?.points.autoHive ?? null],
		['dcHivePoints', (r, side) => r[side].breakdown?.points.teleopHive ?? null],
		['dcFlowerPoints', (r, side) => r[side].breakdown?.points.teleopFlower ?? null],
		['dcGardenPoints', (r, side) => r[side].breakdown?.points.teleopGarden ?? null],
		['dcParkPoints', (r, side) => r[side].breakdown?.points.teleopPark ?? null],
		['majorsCommitted', (r, side) => r[side].breakdown?.majorFouls ?? null],
		['minorsCommitted', (r, side) => r[side].breakdown?.minorFouls ?? null]
	];

function matches(bundle: EventBundle, s: ScoutEvent) {
	const c = check('matches');
	const scoutByKey = new Map(
		s.matches.map((m) => [scoutMatchKey(m.tournamentLevel, m.series, m.matchNum).key, m])
	);
	const played = bundle.matches.filter((m) => m.result);
	const scoutPlayed = s.matches.filter((m) => m.hasBeenPlayed && m.scores);
	if (played.length !== scoutPlayed.length)
		flag(c, `played matches PitStop ${played.length} vs FTCScout ${scoutPlayed.length}`);
	for (const match of played) {
		const other = scoutByKey.get(match.key);
		if (!other?.scores) {
			flag(c, `${match.label} has no FTCScout score`);
			continue;
		}
		c.checked++;
		for (const side of ['red', 'blue'] as const) {
			const mine = match[side].map((t) => t.team).sort();
			const theirs = other.teams
				.filter((t) => t.alliance.toLowerCase() === side)
				.map((t) => t.teamNumber)
				.sort();
			if (mine.join() !== theirs.join())
				flag(c, `${match.label} ${side} teams ${mine.join('/')} vs ${theirs.join('/')}`);
			for (const [field, get] of PART_KEYS) {
				const value = get(match.result!, side);
				if (value === null) continue;
				if (value !== other.scores[side][field])
					flag(c, `${match.label} ${side} ${field} ${value} vs ${other.scores[side][field]}`);
			}
		}
	}
	return c;
}

function without(list: string[], remove: string[]): string[] {
	const left = [...remove];
	return list.filter((item) => {
		const i = left.indexOf(item);
		if (i < 0) return true;
		left.splice(i, 1);
		return false;
	});
}

function awards(bundle: EventBundle, s: ScoutEvent) {
	const c = check('awards');
	const mine = bundle.awards
		.filter((a) => a.team)
		.map((a) => `${a.team}:${a.placement}`)
		.sort();
	const theirs = s.awards
		.filter((a) => a.teamNumber)
		.map((a) => `${a.teamNumber}:${a.placement}`)
		.sort();
	c.checked = mine.length;
	const onlyMine = without(mine, theirs);
	const onlyTheirs = without(theirs, mine);
	if (onlyMine.length || onlyTheirs.length)
		flag(
			c,
			`only on PitStop [${onlyMine.join(' ')}], only on FTCScout [${onlyTheirs.join(' ')}] (team:placement)`
		);
	const winners = new Set(bundle.awards.filter((a) => a.id === 13).map((a) => a.team));
	const final = bundle.matches.filter((m) => m.level === 'playoff' && m.result?.winner).at(-1);
	if (final && winners.size) {
		const champs = final[final.result!.winner!].map((t) => t.team);
		if (!champs.every((t) => winners.has(t)))
			flag(c, `last playoff winner ${champs.join('/')} not all in Winning Alliance award`);
	}
	return c;
}

type FtcAlliance = {
	number: number;
	captain: { teamNumber: number } | null;
	round1: { teamNumber: number } | null;
	round2: { teamNumber: number } | null;
	backup: { teamNumber: number } | null;
};

function alliances(bundle: EventBundle, raw: { alliances: FtcAlliance[] } | null) {
	const c = check('alliances');
	for (const a of raw?.alliances ?? []) {
		if (!a.captain) continue;
		c.checked++;
		const mine = bundle.alliances.find((x) => x.seed === a.number);
		const expected = [a.captain, a.round1, a.round2]
			.filter((t) => t && t.teamNumber > 0)
			.map((t) => t!.teamNumber);
		const got = mine ? [mine.captain, ...mine.picks] : [];
		if (expected.join() !== got.join())
			flag(c, `alliance ${a.number} FIRST ${expected.join('/')} vs PitStop ${got.join('/')}`);
	}
	for (const m of bundle.matches.filter((x) => x.level === 'playoff')) {
		for (const side of ['red', 'blue'] as const) {
			const teams = m[side].map((t) => t.team);
			const owner = bundle.alliances.find((a) =>
				teams.every((t) => [a.captain, ...a.picks, a.backup].includes(t))
			);
			if (teams.length && !owner) flag(c, `${m.label} ${side} ${teams.join('/')} not one alliance`);
		}
	}
	return c;
}

type FtcAdvancement = { advancement: { slot: number; team: number | null }[] | null };

function advancement(bundle: EventBundle, raw: FtcAdvancement | null) {
	const c = check('advancement');
	const expected = (raw?.advancement ?? [])
		.slice()
		.sort((a, b) => a.slot - b.slot)
		.map((s) => s.team);
	const got = (bundle.advancement?.teams ?? []).map((t) => t.team);
	c.checked = expected.length;
	if (expected.join() !== got.join())
		flag(c, `FIRST ${expected.join('/')} vs PitStop ${got.join('/')}`);
	return c;
}

const INSIGHT_FIELDS: [string, string][] = [
	['total', 'totalPointsNp'],
	['auto', 'autoPoints'],
	['teleop', 'dcPoints'],
	['hive', 'dcHivePoints'],
	['flower', 'dcFlowerPoints'],
	['garden', 'dcGardenPoints']
];

function insights(bundle: EventBundle, s: ScoutEvent) {
	const c = check('insights');
	const mine = partAverages(eventRecordRows(bundle.event, bundle.matches)) as Record<
		string,
		number
	> | null;
	const sides = s.matches.flatMap((m) =>
		m.hasBeenPlayed && m.scores ? [m.scores.red, m.scores.blue] : []
	);
	if (!mine || !sides.length) return c;
	for (const [key, field] of INSIGHT_FIELDS) {
		c.checked++;
		const theirs = sides.reduce((sum, side) => sum + side[field], 0) / sides.length;
		if (Math.abs(theirs - mine[key]) > 1e-6)
			flag(c, `${key} average ${mine[key].toFixed(2)} vs ${theirs.toFixed(2)}`);
	}
	return c;
}

function oprs(bundle: EventBundle, analysis: EventAnalysis, s: ScoutEvent) {
	const scoutOpr = new Map(
		s.teams.filter((t) => t.stats?.opr).map((t) => [t.teamNumber, t.stats!.opr!])
	);
	const rows = analysis.ratings
		.filter((r) => scoutOpr.has(r.team))
		.map((r) => ({ team: r.team, pitstop: r.opr, scout: scoutOpr.get(r.team)!.totalPointsNp }));
	const all = bundle.matches.filter((m) => m.result);
	const quals = all.filter((m) => m.level === 'qual');
	const lsAll = leastSquaresOpr(all, 'np');
	const lsQual = leastSquaresOpr(quals, 'np');
	const lsAllTotal = leastSquaresOpr(all, 'total');
	const vs = (get: (team: number) => number | undefined) =>
		summarize(
			rows.flatMap((r) => {
				const v = get(r.team);
				return v === undefined ? [] : [{ a: v, b: r.scout }];
			})
		);
	return {
		teams: rows.length,
		pitstopVsScout: summarize(rows.map((r) => ({ a: r.pitstop, b: r.scout }))),
		rankAgreement: spearman(rows.map((r) => [r.pitstop, r.scout])),
		lsAllNpVsScout: vs((t) => lsAll.get(t)),
		lsQualNpVsScout: vs((t) => lsQual.get(t)),
		lsAllTotalVsScout: vs((t) => lsAllTotal.get(t)),
		pitstopVsLsAllNp: summarize(
			rows.flatMap((r) => (lsAll.has(r.team) ? [{ a: r.pitstop, b: lsAll.get(r.team)! }] : []))
		),
		largest: rows
			.map((r) => ({ ...r, diff: Math.round((r.pitstop - r.scout) * 10) / 10 }))
			.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
			.slice(0, 3)
	};
}

function oddities(bundle: EventBundle) {
	const teams = bundle.matches.flatMap((m) => [...m.red, ...m.blue]);
	return {
		surrogates: teams.filter((t) => t.surrogate).length,
		noShows: teams.filter((t) => t.noShow).length,
		dqs: teams.filter((t) => t.dq).length
	};
}

async function writeSnapshot(code: string, s: ScoutEvent) {
	const file = `${snapshotRoot}audit-${code}.json`;
	const value = {
		code,
		recordedAt: new Date().toISOString(),
		teams: s.teams
			.filter((t) => t.stats)
			.map((t) => ({ team: t.teamNumber, ...t.stats }))
			.sort((a, b) => a.team - b.team),
		matches: s.matches
			.filter((m) => m.hasBeenPlayed && m.scores)
			.map((m) => ({
				key: scoutMatchKey(m.tournamentLevel, m.series, m.matchNum).key,
				red: m.scores!.red,
				blue: m.scores!.blue
			}))
	};
	const config = await prettier.resolveConfig(file);
	await writeFile(
		file,
		await prettier.format(JSON.stringify(value), { ...config, filepath: file })
	);
}

const out: Record<string, unknown> = {};
for (const code of CODES) {
	const [rawRankings, rawAlliances, rawAdvancement] = await Promise.all([
		cached(code, 'ftc-rankings', () => ftcRaw(code, `rankings/${code}`)),
		cached(code, 'ftc-alliances', () => ftcRaw(code, `alliances/${code}`)),
		cached(code, 'ftc-advancement', () => ftcRaw(code, `advancement/${code}`))
	]);
	const s = await cached(code, 'ftcscout', () => scout(code));
	const bundle = await cached(code, 'pitstop-bundle', () =>
		pitstop<EventBundle>(`/api/events/${code}`)
	);
	const analysis = await cached(code, 'pitstop-analysis', () =>
		pitstop<EventAnalysis>(`/api/events/${code}/analysis`)
	);
	if (!s) {
		out[code] = { error: 'not on FTCScout' };
		continue;
	}
	if (snapshot) await writeSnapshot(code, s);
	const checks = [
		rankings(bundle, rawRankings as { rankings: FtcRanking[] } | null, s),
		matches(bundle, s),
		awards(bundle, s),
		alliances(bundle, rawAlliances as { alliances: FtcAlliance[] } | null),
		advancement(bundle, rawAdvancement as FtcAdvancement | null),
		insights(bundle, s)
	];
	out[code] = {
		name: bundle.event.name,
		type: bundle.event.type,
		source: bundle.source,
		teams: bundle.teams.length,
		played: bundle.matches.filter((m) => m.result).length,
		oddities: oddities(bundle),
		checks,
		opr: oprs(bundle, analysis, s)
	};
	console.log(
		`${code}: ${checks.map((c) => `${c.area} ${c.ok ? 'ok' : 'DIFF'} (${c.checked})`).join(', ')}`
	);
}

const report = fileURLToPath(new URL('../../.cache/audit/results.json', import.meta.url));
await writeFile(report, JSON.stringify(out, null, 2));
console.log(`wrote ${report}`);
