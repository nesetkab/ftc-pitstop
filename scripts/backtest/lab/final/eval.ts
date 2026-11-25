import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../../engine.ts';
import { fitMapping, pairedGap, probAt, rowsOf, score } from '../../metrics.ts';
import type { Model } from '../../models.ts';
import { ALL, ENGINE, FULL_FIT, print, report, shipped, TRAIN } from '../harness.ts';
import { load } from '../pooled/oddbot.ts';
import { make } from '../pooled/variants.ts';
import { data } from '../robot/setup.ts';
import { build, SPECS } from './model.ts';

const args = process.argv.slice(2);
const flag = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const label = flag('label') ?? 'final';
const names = args.filter((a) => !a.startsWith('--'));

const models: Model[] = [await shipped(), make('robot-imb')];
if (args.includes('--blend')) models.push(make('blend-robot'));
for (const n of names.length ? names : Object.keys(SPECS)) models.push(build(n));

const t0 = Date.now();
const rec = run(await data(ALL), models, ENGINE);
const reports = report(rec, FULL_FIT);
console.log(`\n== ${label} (${rec.n} matches, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
print(reports);

const maps = reports.map((r) => r.mapping);
const test = (r: number) => rec.season[r] === 2026;
console.log('\npaired 2026 gap (row minus column), se in brackets');
console.log(''.padEnd(18), ...models.slice(1).map((m) => m.name.slice(0, 16).padStart(19)));
const gaps = models.map((m, k) => {
	const row = models.slice(1).map((_, j) => pairedGap(rec, k, j + 1, maps[k], maps[j + 1], test));
	console.log(m.name.slice(0, 18).padEnd(18), ...row.map((g) => `${g.diff.toFixed(5)} [${g.se.toFixed(5)}]`.padStart(19)));
	return row[0];
});

const loso: Record<number, number[]> = {};
if (args.includes('--loso')) console.log('\nleave-one-season-out (mapping fit on the other train seasons)');
if (args.includes('--loso')) console.log('season'.padEnd(8), ...models.map((m) => m.name.slice(0, 12).padStart(13)));
for (const s of args.includes('--loso') ? TRAIN : []) {
	const rows = rowsOf(rec, (r) => rec.season[r] !== s && TRAIN.includes(rec.season[r]));
	loso[s] = models.map((_, k) => score(rec, k, fitMapping(rec, k, rows, FULL_FIT), (r) => rec.season[r] === s).brier);
	console.log(String(s).padEnd(8), ...loso[s].map((b) => b.toFixed(5).padStart(13)));
}

const odd = await load(2026);
const sums = { all: { n: 0, odd: 0, ours: models.map(() => 0) }, quals: { n: 0, odd: 0, ours: models.map(() => 0) }, playoffs: { n: 0, odd: 0, ours: models.map(() => 0) } };
for (let r = 0; r < rec.n; r++) {
	if (!test(r)) continue;
	const o = odd.get(rec.keys[r]);
	if (!o) continue;
	const y = rec.outcome[r];
	for (const g of [sums.all, rec.playoff[r] ? sums.playoffs : sums.quals]) {
		g.n++;
		g.odd += (o.pRed - y) ** 2;
		models.forEach((_, k) => (g.ours[k] += (probAt(rec, k, r, maps[k]) - y) ** 2));
	}
}
console.log('\nvs oddbot on their 2026 matches');
console.log('group'.padEnd(10), 'n'.padStart(6), 'oddbot'.padStart(8), ...models.map((m) => m.name.slice(0, 12).padStart(13)));
for (const [g, a] of Object.entries(sums))
	console.log(g.padEnd(10), String(a.n).padStart(6), (a.odd / a.n).toFixed(4).padStart(8), ...a.ours.map((v) => (v / a.n).toFixed(4).padStart(13)));

const dir = join(import.meta.dirname, 'results');
await mkdir(dir, { recursive: true });
await writeFile(
	join(dir, `${label}.json`),
	`${JSON.stringify({ reports, gaps: models.map((m, k) => ({ name: m.name, ...gaps[k] })), loso, oddbot: sums }, null, '\t')}\n`
);
