import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load as loadOdd } from '../audit/oddbot.ts';
import { DIR, load } from './data.ts';
import { Ctx, logistic, logit } from './lib.ts';
import { TYPES } from './probe.ts';

const dump = await load(process.argv[2] ?? 'main');
const ctx = new Ctx(dump);
const odd = await loadOdd(2026);
const rows: number[] = [];
const po: number[] = [];
const keyRow = new Map(ctx.rec.keys.map((k, r) => [k, r]));
for (const [key, o] of odd) {
	const r = keyRow.get(key);
	if (r === undefined) continue;
	rows.push(r);
	po[r] = o.pRed;
}
console.log(`matched ${rows.length} of ${odd.size} oddbot matches`);
const y = ctx.rec.outcome;
const name = process.argv[2] ?? 'main';
const labels = JSON.parse(await readFile(join(DIR, name, 'oof.json'), 'utf8')) as string[];
const buf = await readFile(join(DIR, name, 'oof.bin'));
const copy = new Uint8Array(buf.byteLength);
copy.set(buf);
const oof = new Float64Array(copy.buffer);
const models: [string, (r: number) => number][] = [['shipped', (r) => ctx.base[r]]];
for (const label of (process.argv[3] ?? '').split(',').filter(Boolean)) {
	const i = labels.indexOf(label);
	if (i < 0) throw new Error(label);
	models.push([label, (r) => oof[i * ctx.rec.n + r]]);
}
models.push(['oddbot', (r) => po[r]]);

function stats(sel: number[], p: (r: number) => number) {
	let b = 0;
	let sharp = 0;
	let fav = 0;
	let favWin = 0;
	for (const r of sel) {
		const q = p(r);
		b += (q - y[r]) ** 2;
		sharp += Math.abs(q - 0.5);
		fav += Math.max(q, 1 - q);
		favWin += q >= 0.5 ? y[r] : 1 - y[r];
	}
	const n = sel.length;
	const z = new Float64Array(ctx.rec.n);
	const one = new Float64Array(ctx.rec.n).fill(1);
	for (const r of sel) z[r] = logit(p(r));
	const w = logistic([z, one], y, Int32Array.from(sel), 1e-6);
	return { b: b / n, sharp: sharp / n, fav: fav / n, favWin: favWin / n, slope: w[0] };
}

function table(label: string, bucket: (r: number) => string | null) {
	const groups = new Map<string, number[]>();
	for (const r of rows) {
		const k = bucket(r);
		if (k === null) continue;
		if (!groups.has(k)) groups.set(k, []);
		groups.get(k)!.push(r);
	}
	console.log(`\n${label}`);
	console.log(
		'bucket'.padEnd(18),
		'n'.padStart(5),
		...models.map(([m]) => `${m.slice(0, 10).padStart(10)} B/sharp/fav/slope`.padStart(34))
	);
	for (const k of [...groups.keys()].sort()) {
		const sel = groups.get(k)!;
		const cells = models.map(([, p]) => {
			const s = stats(sel, p);
			return `${s.b.toFixed(4)} ${s.sharp.toFixed(3)} ${s.fav.toFixed(3)}/${s.favWin.toFixed(3)} ${s.slope.toFixed(2)}`.padStart(
				34
			);
		});
		console.log(k.padEnd(18), String(sel.length).padStart(5), ...cells);
	}
}

const quals = (r: number) => ctx.rec.playoff[r] === 0;
const F = (r: number, k: Parameters<Ctx['f']>[1]) => ctx.f(r, k);
table('all by phase', (r) => (quals(r) ? 'quals' : 'playoffs'));
table('quals by unplayed teams at event', (r) =>
	quals(r) ? String(F(r, 'redUnplayed') + F(r, 'blueUnplayed')) : null
);
table('quals by min matches played', (r) =>
	quals(r) ? String(Math.min(F(r, 'minPlayed'), 6)) : null
);
table('quals by teams new to season', (r) => (quals(r) ? String(F(r, 'firstEvent')) : null));
table('quals by event type', (r) => (quals(r) ? (TYPES[F(r, 'type')] ?? 'Other') : null));
table('quals by week', (r) =>
	quals(r) ? `w${String(Math.min(Math.floor(F(r, 'week') / 2) * 2, 12)).padStart(2, '0')}` : null
);
table('quals by shipped confidence', (r) =>
	quals(r) ? `p${Math.floor(Math.max(ctx.base[r], 1 - ctx.base[r]) * 10) / 10}` : null
);
table('quals by oddbot confidence', (r) =>
	quals(r) ? `p${Math.floor(Math.max(po[r], 1 - po[r]) * 10) / 10}` : null
);
table('quals by event size', (r) =>
	quals(r)
		? `t${String(Math.min(Math.floor(F(r, 'eventTeams') / 8) * 8, 40)).padStart(2, '0')}`
		: null
);
