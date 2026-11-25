import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { run } from '../../engine.ts';
import { fitMapping, probAt, rowsOf } from '../../metrics.ts';
import { ALL, ENGINE, FULL_FIT, shipped, TRAIN } from '../harness.ts';
import { data } from './setup.ts';
import { VARIANTS } from './variants.ts';

const ODD = join(import.meta.dirname, '..', '..', '..', '..', '.cache', 'oddbot', '2026', 'event');

type OddMatch = { id: number; played: boolean; pred: { pRed: number } | null; redScore: unknown };

function oddbot(): Map<string, number> {
	const out = new Map<string, number>();
	for (const f of readdirSync(ODD)) {
		const e = JSON.parse(readFileSync(join(ODD, f), 'utf8')) as { code: string; matchList: OddMatch[] };
		for (const m of e.matchList) {
			if (m.played && m.pred && m.redScore) out.set(`2026:${e.code}:${m.id}`, m.pred.pRed);
		}
	}
	return out;
}

function load(name: string): Record<string, unknown> {
	const [base, file] = name.split('@');
	try {
		return JSON.parse(readFileSync(join(import.meta.dirname, 'params', `${file ?? base}.json`), 'utf8'));
	} catch {
		return VARIANTS[base].start;
	}
}

const names = process.argv.slice(2);
const seasons = await data(ALL);
const models = [await shipped(), ...names.map((n) => VARIANTS[n.split('@')[0]].make(load(n), n))];
const rec = run(seasons, models, ENGINE);
const train = new Set(TRAIN);
const maps = models.map((_, k) => fitMapping(rec, k, rowsOf(rec, (r) => train.has(rec.season[r])), FULL_FIT));

const fresh = new Map<string, number>();
const info = new Map<string, { type: string; week: number }>();
const events2026 = seasons[seasons.length - 1];
const first = events2026[0].day;
for (const e of events2026) {
	const played = new Set<number>();
	for (const m of e.matches) {
		const key = `2026:${e.code}:${m.id}`;
		fresh.set(key, [...m.red, ...m.blue].filter((t) => !played.has(t)).length);
		info.set(key, { type: e.type, week: Math.floor((e.day - first) / 7) });
		for (const t of [...m.redUpd, ...m.blueUpd]) played.add(t);
	}
}

const odd = oddbot();
type Acc = { n: number; b: number[] };
const groups = new Map<string, Acc>();
const add = (g: string, bs: number[]) => {
	const a = groups.get(g) ?? { n: 0, b: bs.map(() => 0) };
	a.n++;
	bs.forEach((x, i) => (a.b[i] += x));
	groups.set(g, a);
};
for (let r = 0; r < rec.n; r++) {
	if (rec.season[r] !== 2026) continue;
	const key = rec.keys[r];
	const po = odd.get(key);
	if (po === undefined) continue;
	const y = rec.outcome[r];
	const bs = [...models.map((_, k) => (probAt(rec, k, r, maps[k]) - y) ** 2), (po - y) ** 2];
	const f = fresh.get(key) ?? 0;
	const i = info.get(key)!;
	const lvl = rec.playoff[r] ? 'playoff' : 'qual';
	add('all', bs);
	add(lvl, bs);
	if (!rec.playoff[r]) {
		add(`qual fresh=${f === 0 ? '0' : f <= 2 ? '1-2' : '3-4'}`, bs);
		add(`qual type=${i.type}`, bs);
		add(`qual week=${Math.min(i.week, 8)}`, bs);
	}
}
const cols = [...models.map((m) => m.name), 'oddbot'];
console.log('group'.padEnd(30), 'n'.padStart(6), ...cols.map((c) => c.slice(0, 12).padStart(12)));
for (const [g, a] of [...groups].sort((x, y) => x[0].localeCompare(y[0]))) {
	console.log(g.padEnd(30), String(a.n).padStart(6), ...a.b.map((x) => (x / a.n).toFixed(4).padStart(12)));
}
