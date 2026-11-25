import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../../engine.ts';
import { fitMapping, rowsOf, score, type FitOptions } from '../../metrics.ts';
import { ENGINE, TRAIN } from '../harness.ts';
import { data } from '../robot/setup.ts';
import type { Model } from '../../models.ts';
import { make } from '../pooled/variants.ts';
import { Fan, ROBOT_HET, Tap, type Gap, type Head } from './heads.ts';

const args = process.argv.slice(2);
const flag = (k: string, d: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const list = (k: string, d: string) => flag(k, d).split(',').map(Number);
const fit: FitOptions = { links: ['logit'], etas: [0, 0.1], gammas: list('gammas', '0.25,0.375,0.5') };
const imbFit = Number(flag('imbF', '0.1'));
const imbs = list('imb', '0.2');
const floors = flag('floor', 'none,0,0.15,0.26,0.35').split(',');
const widths = list('width', '0.08,0.16,0.3');
const gaps = flag('gap', 'rest').split(',') as Gap[];
const floorScore = args.includes('--floorScore');
const imbRobots = list('imbRobot', '0');
const pooledWs = list('pooled', '0');
const label = flag('label', `sweep-f${imbFit}`);

const heads: Record<string, Head> = {};
for (const imb of imbs)
	for (const gap of gaps)
		for (const imbRobot of imbRobots)
			for (const pooled of pooledWs)
				for (const fl of floors) {
					const tag = `i${imb} ${gap}${imbRobot ? ` r${imbRobot}` : ''}${pooled ? ` p${pooled}` : ''}`;
					if (fl === 'none') {
						if (gap !== 'floored') heads[`${tag} none`] = { imb, gap, imbRobot, pooled };
						continue;
					}
					for (const width of widths)
						heads[`${tag} f${fl} w${width}`] = { imb, gap, imbRobot, pooled, floor: Number(fl), width, floorScore };
				}

const fitFloor = flag('fitFloor', '');
const fan = new Fan(
	ROBOT_HET,
	imbFit,
	fitFloor ? { floor: Number(fitFloor.split(',')[0]), width: Number(fitFloor.split(',')[1]) } : undefined
);
const models: Model[] = fan.views(heads);
if (pooledWs.some((w) => w > 0)) {
	fan.tap = new Tap('pooled-imb', make('pooled-imb'));
	models.unshift(fan.tap);
}
const t0 = Date.now();
const rec = run(await data(TRAIN), models, ENGINE);
const rows = rowsOf(rec, () => true);
const out = models.map((m, k) => {
	const map = fitMapping(rec, k, rows, fit);
	const s = score(rec, k, map, () => true);
	return { name: m.name, brier: s.brier, mae: s.mae, map };
});
out.sort((a, b) => a.brier - b.brier);
console.log(`== ${label} imbFit=${imbFit} fitFloor=${fitFloor} (${rec.n} train matches, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
for (const r of out)
	console.log(r.name.padEnd(30), r.brier.toFixed(5), r.mae.toFixed(2), r.map.eta, r.map.gamma);
const dir = join(import.meta.dirname, 'results');
await mkdir(dir, { recursive: true });
await writeFile(join(dir, `${label}.json`), `${JSON.stringify(out, null, '\t')}\n`);
