import { run } from '../../engine.ts';
import { fitMapping, probAt, rowsOf } from '../../metrics.ts';
import { ALL, ENGINE, QUICK_FIT, shipped, TRAIN } from '../harness.ts';
import { data as robotData } from '../robot/setup.ts';
import { load } from './oddbot.ts';
import { make } from './variants.ts';

const names = process.argv.slice(2);
const data = await robotData(ALL);
const models = [await shipped(), ...names.map((n) => make(n))];
const rec = run(data, models, ENGINE);
const train = new Set(TRAIN);
const rows = rowsOf(rec, (r) => train.has(rec.season[r]));
const maps = models.map((_, k) => fitMapping(rec, k, rows, QUICK_FIT));
const test = rowsOf(rec, (r) => rec.season[r] === 2026);
const insample = models.map((_, k) => fitMapping(rec, k, test, QUICK_FIT));

const fresh = new Map<
	string,
	{ zero: number; seasonNew: number; prevNew: number; minPlayed: number }
>();
const lastSeason = new Set<number>();
for (const e of data[ALL.indexOf(2025)])
	for (const m of e.matches) for (const t of [...m.red, ...m.blue]) lastSeason.add(t);
const seen = new Set<number>();
for (const e of data[ALL.indexOf(2026)]) {
	const played = new Map<number, number>();
	const before = new Set(seen);
	for (const m of e.matches) {
		const teams = [...m.red, ...m.blue];
		const zeros = teams.filter((t) => !played.get(t));
		fresh.set(`2026:${m.key}`, {
			zero: zeros.length,
			seasonNew: zeros.filter((t) => !before.has(t)).length,
			prevNew: zeros.filter((t) => !before.has(t) && !lastSeason.has(t)).length,
			minPlayed: Math.min(...teams.map((t) => played.get(t) ?? 0))
		});
		for (const t of [...m.redUpd, ...m.blueUpd]) played.set(t, (played.get(t) ?? 0) + 1);
	}
	for (const m of e.matches) for (const t of [...m.red, ...m.blue]) seen.add(t);
}

const odd = await load(2026);
type Acc = {
	n: number;
	odd: number;
	ours: number[];
	oddAcc: number;
	acc: number[];
	decided: number;
};
const groups = new Map<string, Acc>();
let cur = { y: 0, po: 0, pk: [] as number[] };
const hit = (p: number, y: number) => (p === 0.5 ? 0.5 : p > 0.5 === (y === 1) ? 1 : 0);
const add = (g: string, o: number, ours: number[]) => {
	const a = groups.get(g) ?? {
		n: 0,
		odd: 0,
		ours: ours.map(() => 0),
		oddAcc: 0,
		acc: ours.map(() => 0),
		decided: 0
	};
	a.n++;
	a.odd += o;
	ours.forEach((v, k) => (a.ours[k] += v));
	if (cur.y !== 0.5) {
		a.decided++;
		a.oddAcc += hit(cur.po, cur.y);
		cur.pk.forEach((p, k) => (a.acc[k] += hit(p, cur.y)));
	}
	groups.set(g, a);
};
for (let r = 0; r < rec.n; r++) {
	if (rec.season[r] !== 2026) continue;
	const key = rec.keys[r];
	const o = odd.get(key);
	if (!o) continue;
	const y = rec.outcome[r];
	const ob = (o.pRed - y) ** 2;
	const pk = models.map((_, k) => probAt(rec, k, r, maps[k]));
	const ours = [
		...pk.map((p) => (p - y) ** 2),
		...models.map((_, k) => (probAt(rec, k, r, insample[k]) - y) ** 2)
	];
	cur = { y, po: o.pRed, pk };
	const f = fresh.get(key)!;
	const phase = rec.playoff[r] ? 'playoff' : 'quals';
	add('all', ob, ours);
	add(phase, ob, ours);
	if (!rec.playoff[r]) {
		add(`quals zero=${f.zero}`, ob, ours);
		if (f.zero === 0) add(`quals minPlayed=${Math.min(f.minPlayed, 6)}`, ob, ours);
		add(`quals seasonNew=${Math.min(f.seasonNew, 2)}`, ob, ours);
		add(`quals prevNew=${Math.min(f.prevNew, 2)}`, ob, ours);
		add(`quals type=${o.type}`, ob, ours);
		add(`quals start=${o.start.slice(0, 7)}`, ob, ours);
	}
}
console.log(
	'group'.padEnd(26),
	'n'.padStart(6),
	'oddbot'.padStart(8),
	...models.map((m) => m.name.slice(0, 12).padStart(13)),
	...models.map((m) => `${m.name.slice(0, 9)}*`.padStart(11)),
	'oddAcc'.padStart(7),
	...models.map((m) => `${m.name.slice(0, 6)}A`.padStart(8))
);
for (const [g, a] of [...groups].sort((x, y) => x[0].localeCompare(y[0]))) {
	console.log(
		g.padEnd(26),
		String(a.n).padStart(6),
		(a.odd / a.n).toFixed(4).padStart(8),
		...a.ours.slice(0, models.length).map((v) => (v / a.n).toFixed(4).padStart(13)),
		...a.ours.slice(models.length).map((v) => (v / a.n).toFixed(4).padStart(11)),
		((100 * a.oddAcc) / a.decided).toFixed(1).padStart(7),
		...a.acc.map((v) => ((100 * v) / a.decided).toFixed(1).padStart(8))
	);
}
