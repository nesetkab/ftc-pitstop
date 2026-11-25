import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '.cache', 'oddbot');
const BASE = 'https://oddbot.org/data';
const USER_AGENT = 'pitstop-audit/1.0';

type OddScore = { np: number; total: number };

type OddMatch = {
	id: number;
	level: string;
	played: boolean;
	red: number[];
	blue: number[];
	redScore: OddScore | null;
	blueScore: OddScore | null;
	pred: { pRed: number; red: OddScore; blue: OddScore } | null;
};

type OddEvent = { code: string; type: string; start: string; matchList: OddMatch[] };

export type OddRow = {
	key: string;
	code: string;
	type: string;
	start: string;
	playoff: boolean;
	pRed: number;
	predRed: number;
	predBlue: number;
	redNp: number;
	blueNp: number;
	redTotal: number;
	blueTotal: number;
	teams: string;
};

async function get(url: string): Promise<string> {
	const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
	if (!res.ok) throw new Error(`${res.status} ${url}`);
	return res.text();
}

export async function download(season: number): Promise<void> {
	const dir = join(ROOT, String(season));
	await mkdir(join(dir, 'event'), { recursive: true });
	for (const f of ['meta', 'events']) {
		await writeFile(join(dir, `${f}.json`), await get(`${BASE}/${season}/${f}.json`));
	}
	const events = JSON.parse(await readFile(join(dir, 'events.json'), 'utf8')) as {
		code: string;
		played: number;
	}[];
	for (const e of events.filter((x) => x.played > 0)) {
		const path = join(dir, 'event', `${e.code}.json`);
		if (existsSync(path)) continue;
		await writeFile(path, await get(`${BASE}/${season}/event/${e.code}.json`));
		await new Promise((r) => setTimeout(r, 250));
	}
}

export async function meta(season: number): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(join(ROOT, String(season), 'meta.json'), 'utf8'));
}

export async function load(season: number): Promise<Map<string, OddRow>> {
	const dir = join(ROOT, String(season), 'event');
	const out = new Map<string, OddRow>();
	for (const f of await readdir(dir)) {
		const e = JSON.parse(await readFile(join(dir, f), 'utf8')) as OddEvent;
		for (const m of e.matchList) {
			if (!m.played || !m.pred || !m.redScore || !m.blueScore) continue;
			const key = `${season}:${e.code}:${m.id}`;
			out.set(key, {
				key,
				code: e.code,
				type: e.type,
				start: e.start,
				playoff: m.level !== 'Quals',
				pRed: m.pred.pRed,
				predRed: m.pred.red.np,
				predBlue: m.pred.blue.np,
				redNp: m.redScore.np,
				blueNp: m.blueScore.np,
				redTotal: m.redScore.total,
				blueTotal: m.blueScore.total,
				teams: `${[...m.red].sort().join(',')}|${[...m.blue].sort().join(',')}`
			});
		}
	}
	return out;
}

if (import.meta.main) await download(Number(process.argv[2] ?? 2026));
