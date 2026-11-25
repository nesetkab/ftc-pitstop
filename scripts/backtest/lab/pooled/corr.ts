import { run, STRIDE } from '../../engine.ts';
import { ENGINE, seasons, shipped, TRAIN } from '../harness.ts';

type Acc = { n: number; sr: number; sb: number; srr: number; sbb: number; srb: number };

const rec = run(await seasons(TRAIN), [await shipped()], ENGINE);
const by = new Map<number, Acc>();
for (let r = 0; r < rec.n; r++) {
	const o = r * STRIDE;
	const a = rec.redNp[r] - rec.pred[o + 3];
	const b = rec.blueNp[r] - rec.pred[o + 4];
	const k = rec.season[r] * 10 + rec.playoff[r];
	const s = by.get(k) ?? { n: 0, sr: 0, sb: 0, srr: 0, sbb: 0, srb: 0 };
	s.n++;
	s.sr += a;
	s.sb += b;
	s.srr += a * a;
	s.sbb += b * b;
	s.srb += a * b;
	by.set(k, s);
}
for (const [k, s] of [...by].sort((x, y) => x[0] - y[0])) {
	const ma = s.sr / s.n;
	const mb = s.sb / s.n;
	const va = s.srr / s.n - ma * ma;
	const vb = s.sbb / s.n - mb * mb;
	const c = (s.srb / s.n - ma * mb) / Math.sqrt(va * vb);
	console.log(
		k,
		s.n,
		'corr',
		c.toFixed(3),
		'bias',
		ma.toFixed(2),
		mb.toFixed(2),
		'sd',
		Math.sqrt(va).toFixed(1)
	);
}
