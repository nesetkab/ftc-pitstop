import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build, CANDIDATES } from '../../candidates.ts';
import { run } from '../../engine.ts';
import { KalmanOpr, type Ctx, type EpaParams, type Model, type OprParams, type Pred } from '../../models.ts';
import type { PMatch } from '../../prep.ts';
import { ALL, ENGINE } from '../harness.ts';
import { RobotOpr, type RoprOpts } from '../robot/ropr.ts';
import { data } from '../robot/setup.ts';
import { save } from './data.ts';
import { ProbeOpr } from './probe.ts';

class RobotProbe extends RobotOpr {
	season = 0;
	hilo = new Map<string, Float64Array>();

	startEvent(event: Parameters<RobotOpr['startEvent']>[0], ctx: Ctx): void {
		this.season = event.season;
		super.startEvent(event, ctx);
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		const pred = super.predict(m, ctx);
		const vals = (ts: number[]) => ts.map((t) => this.side([t], false)).sort((a, b) => b - a);
		const r = vals(m.red);
		const b = vals(m.blue);
		this.hilo.set(
			`${this.season}:${m.key}`,
			Float64Array.of(r[0], r[r.length - 1], b[0], b[b.length - 1])
		);
		return pred;
	}
}

const stored = JSON.parse(
	await readFile(join(import.meta.dirname, '..', '..', 'params.json'), 'utf8')
) as { candidates: Record<string, OprParams | EpaParams> };
const opr = stored.candidates['opr-map'] as OprParams;
const het = JSON.parse(
	await readFile(join(import.meta.dirname, '..', 'robot', 'params', 'het.json'), 'utf8')
) as RoprOpts;
const probe = new ProbeOpr('shipped', opr);
const robot = new RobotProbe('robot-het', het);
const named = (id: string): Model =>
	build(CANDIDATES.find((c) => c.id === id)!, stored.candidates[id]);
const models: Model[] = [
	probe,
	robot,
	named('epa-reset'),
	new KalmanOpr('opr-loose', { ...opr, lamNew: 1, lamPrevSeason: 1, q: 0.3 })
];

const t0 = Date.now();
const rec = run(await data(ALL), models, ENGINE);
console.log(`ran ${rec.n} matches in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
await save(process.argv[2] ?? 'robot', rec, probe.features, robot.hilo);
