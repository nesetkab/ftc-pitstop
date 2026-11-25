import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DIR, load } from './data.ts';
import { Ctx } from './lib.ts';

const name = process.argv[2] ?? 'robot';
const ctx = new Ctx(await load(name));
const labels = JSON.parse(await readFile(join(DIR, name, 'oof.json'), 'utf8')) as string[];
const buf = await readFile(join(DIR, name, 'oof.bin'));
const copy = new Uint8Array(buf.byteLength);
copy.set(buf);
const oof = new Float64Array(copy.buffer);
const n = ctx.rec.n;
const get = (label: string) => {
	const i = labels.indexOf(label);
	if (i < 0) throw new Error(label);
	return oof.subarray(i * n, (i + 1) * n);
};
const y = ctx.rec.outcome;
const gap = (a: Float64Array, b: Float64Array, rows: Iterable<number>) => {
	let k = 0;
	let s = 0;
	let sq = 0;
	for (const r of rows) {
		const d = (a[r] - y[r]) ** 2 - (b[r] - y[r]) ** 2;
		k++;
		s += d;
		sq += d * d;
	}
	const m = s / k;
	return `${m.toFixed(5)} ± ${Math.sqrt((sq / k - m * m) / k).toFixed(5)}`;
};
for (const pair of process.argv.slice(3)) {
	const [a, b] = pair.split('|');
	const pa = get(a);
	const pb = b === 'shipped' ? ctx.base : get(b);
	const test = Array.from(ctx.test);
	console.log(`${a} vs ${b}`);
	console.log('  2026 all     ', gap(pa, pb, test));
	console.log('  2026 quals   ', gap(pa, pb, test.filter((r) => !ctx.rec.playoff[r])));
	console.log('  2026 playoffs', gap(pa, pb, test.filter((r) => ctx.rec.playoff[r])));
	console.log('  train oof    ', gap(pa, pb, ctx.train));
	for (const s of [2021, 2022, 2023, 2024, 2025])
		console.log(`  oof ${s}     `, gap(pa, pb, ctx.trainBySeason.get(s)!));
}
