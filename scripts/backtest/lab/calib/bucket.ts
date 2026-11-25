import { ALL, QUICK_FIT } from '../harness.ts';
import { carryFloor, CARRY_FLOOR } from './alliance.ts';
import { load } from './data.ts';
import { Ctx } from './lib.ts';

const dump = await load(process.argv[2] ?? 'main');
const ctx = new Ctx(dump);
const y = ctx.rec.outcome;
const probs: [string, Float64Array][] = [
	['shipped', ctx.base],
	['carry+floor', carryFloor(ctx, CARRY_FLOOR)]
];
for (const name of (process.argv[3] ?? 'opr-loose,epa-reset').split(','))
	probs.push([name, ctx.fitMapped(ctx.model(name), QUICK_FIT).p]);
const quals = (r: number) => !ctx.rec.playoff[r];
const unplayed = (r: number) => ctx.f(r, 'redUnplayed') + ctx.f(r, 'blueUnplayed');
const buckets: [string, (r: number) => boolean][] = [
	['all', () => true],
	['quals first-event 4', (r) => quals(r) && ctx.f(r, 'firstEvent') === 4],
	['quals first-event 0', (r) => quals(r) && ctx.f(r, 'firstEvent') === 0],
	['quals unplayed 0', (r) => quals(r) && unplayed(r) === 0],
	['quals unplayed 4', (r) => quals(r) && unplayed(r) === 4],
	[
		'quals unplayed 0 first 4',
		(r) => quals(r) && unplayed(r) === 0 && ctx.f(r, 'firstEvent') === 4
	],
	['quals week<6', (r) => quals(r) && ctx.f(r, 'week') < 6],
	['quals week>=6', (r) => quals(r) && ctx.f(r, 'week') >= 6]
];
for (const [label, sel] of buckets) {
	console.log(`\n${label}`);
	console.log(
		'season'.padEnd(8),
		'n'.padStart(6),
		...probs.map(([n]) => n.slice(0, 11).padStart(12))
	);
	for (const s of ALL) {
		let n = 0;
		const b = probs.map(() => 0);
		for (let r = 0; r < ctx.rec.n; r++) {
			if (ctx.rec.season[r] !== s || !sel(r)) continue;
			n++;
			probs.forEach(([, p], k) => (b[k] += (p[r] - y[r]) ** 2));
		}
		console.log(
			String(s).padEnd(8),
			String(n).padStart(6),
			...b.map((v) => (v / n).toFixed(4).padStart(12))
		);
	}
}
