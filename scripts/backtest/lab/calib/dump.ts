import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build, CANDIDATES } from '../../candidates.ts';
import { run } from '../../engine.ts';
import { KalmanOpr, type EpaParams, type Model, type OprParams } from '../../models.ts';
import { ALL, ENGINE, seasons } from '../harness.ts';
import { save } from './data.ts';
import { ProbeOpr } from './probe.ts';
import { OutcomeElo, TotalOpr } from './raters.ts';

const stored = JSON.parse(
	await readFile(join(import.meta.dirname, '..', '..', 'params.json'), 'utf8')
) as { candidates: Record<string, OprParams | EpaParams> };
const opr = stored.candidates['opr-map'] as OprParams;
const probe = new ProbeOpr('shipped', opr);
const named = (id: string): Model => build(CANDIDATES.find((c) => c.id === id)!, stored.candidates[id]);
const models: Model[] = [
	probe,
	named('epa-reset'),
	named('epa'),
	named('opr-event'),
	named('opr-ridge-mean'),
	new KalmanOpr('opr-huber', { ...opr, huber: 2 }),
	new TotalOpr('opr-total', opr),
	new KalmanOpr('opr-loose', { ...opr, lamNew: 1, lamPrevSeason: 1, q: 0.3 }),
	new OutcomeElo('elo', 0.15, 0.5, 0.9)
];

const t0 = Date.now();
const rec = run(await seasons(ALL), models, ENGINE);
console.log(`ran ${rec.n} matches in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
await save(process.argv[2] ?? 'main', rec, probe.features);
