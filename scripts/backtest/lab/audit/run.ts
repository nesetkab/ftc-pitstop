import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build, CANDIDATES } from '../../candidates.ts';
import { run, type Records } from '../../engine.ts';
import { loadSeason } from '../../hist.ts';
import { fitMapping, probAt, rowsOf, type FitOptions, type Mapping } from '../../metrics.ts';
import type { EpaParams, Model, OprParams } from '../../models.ts';
import { prepSeason } from '../../prep.ts';
import { ALL, FULL_FIT, seasons, shipped, TEST, TRAIN } from '../harness.ts';
import { AvgScore, Elo, LiveOpr } from './baselines.ts';
import { load, type OddRow } from './oddbot.ts';

const SIMPLE: FitOptions = { links: ['logit'], etas: [0], gammas: [0] };
const WARMUP = 30;
const OUT = join(import.meta.dirname, 'results');

type Filter = (r: number) => boolean;

type Cell = { n: number; brier: number; accOdd: number; accOurs: number; mae: number };

function cell(n: number, b: number, dec: number, cor: number, all: number, corAll: number, mae: number): Cell {
	return {
		n,
		brier: b / n,
		accOdd: corAll / all,
		accOurs: cor / dec,
		mae: mae / (2 * n)
	};
}

function scoreProbs(rec: Records, prob: (r: number) => number, filter: Filter, pts?: (r: number) => [number, number]): Cell {
	let n = 0;
	let b = 0;
	let dec = 0;
	let cor = 0;
	let corAll = 0;
	let mae = 0;
	for (let r = 0; r < rec.n; r++) {
		if (!filter(r)) continue;
		const p = prob(r);
		const y = rec.outcome[r];
		n++;
		b += (p - y) ** 2;
		const hit = y === 0.5 ? 0 : p === 0.5 ? 0.5 : p > 0.5 === (y === 1) ? 1 : 0;
		corAll += hit;
		if (y !== 0.5) {
			dec++;
			cor += hit;
		}
		if (pts) {
			const [a, c] = pts(r);
			mae += Math.abs(a - rec.redNp[r]) + Math.abs(c - rec.blueNp[r]);
		}
	}
	return cell(n, b, dec, cor, n, corAll, mae);
}

function pairedDiff(rec: Records, pa: (r: number) => number, pb: (r: number) => number, filter: Filter) {
	let n = 0;
	let s = 0;
	let ss = 0;
	for (let r = 0; r < rec.n; r++) {
		if (!filter(r)) continue;
		const y = rec.outcome[r];
		const d = (pa(r) - y) ** 2 - (pb(r) - y) ** 2;
		n++;
		s += d;
		ss += d * d;
	}
	const mean = s / n;
	return { diff: mean, se: Math.sqrt(Math.max(ss / n - mean * mean, 0) / n) };
}

const stored = JSON.parse(
	await readFile(join(import.meta.dirname, '..', '..', 'params.json'), 'utf8')
) as { candidates: Record<string, OprParams | EpaParams> };
const cand = (id: string) => build(CANDIDATES.find((c) => c.id === id)!, stored.candidates[id]);

const models: Model[] = [
	await shipped(),
	cand('opr-event'),
	cand('opr-ridge-mean'),
	new LiveOpr('live-opr mean', 'mean'),
	new LiveOpr('live-opr last', 'last'),
	new LiveOpr('live-opr best', 'best'),
	new LiveOpr('live-opr avg', 'avg'),
	new LiveOpr('live-opr zero', 'zero'),
	new LiveOpr('live-opr mean +playoffs', 'mean', { playoffs: true }),
	new LiveOpr('live-opr best +playoffs', 'best', { playoffs: true }),
	new LiveOpr('live-opr best total', 'best', { total: true }),
	new AvgScore('avg score season', 'season'),
	new AvgScore('avg score event', 'event'),
	new Elo('elo k32 reset', 32, 0),
	new Elo('elo k16 reset', 16, 0),
	new Elo('elo k32 carry', 32, 0.5)
];

const t0 = Date.now();
const evts = await seasons(ALL);
const rec = run(evts, models, { halfLife: Infinity, warmup: 0 });
console.log(`engine ${rec.n} rows in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

const first = new Map<number, number>();
for (let r = 0; r < rec.n; r++) if (!first.has(rec.season[r])) first.set(rec.season[r], r);
const warm: Filter = (r) => r - first.get(rec.season[r])! >= WARMUP;
const trainSet = new Set(TRAIN);
const isTrain: Filter = (r) => trainSet.has(rec.season[r]) && warm(r);
const isTest: Filter = (r) => rec.season[r] === TEST;
const std: Filter = (r) => isTest(r) && warm(r);

const odd = await load(TEST);
const oddAt = new Map<number, OddRow>();
for (let r = first.get(TEST)!; r < rec.n; r++) {
	const o = odd.get(rec.keys[r]);
	if (o) oddAt.set(r, o);
}
const matched: Filter = (r) => oddAt.has(r);

const newTeams = new Int8Array(rec.n);
{
	let r = first.get(TEST)!;
	for (const e of evts[ALL.indexOf(TEST)]) {
		const seen = new Set<number>();
		for (const m of e.matches) {
			newTeams[r++] = [...m.red, ...m.blue].filter((t) => !seen.has(t)).length;
			if (!m.playoff) for (const t of [...m.red, ...m.blue]) seen.add(t);
		}
	}
}

const trainRows = rowsOf(rec, isTrain);
const stdRows = rowsOf(rec, std);
const native: Mapping = { link: 'logit', kappa: 1 / Math.LN10, eta: 0, gamma: 0 };

type Line = { model: string; map: string; set: string; all: Cell; quals: Cell; playoffs: Cell };
const lines: Line[] = [];
const maps: Record<string, Record<string, Mapping>> = {};

const splits = (set: Filter) => ({
	all: set,
	quals: (r: number) => set(r) && rec.playoff[r] === 0,
	playoffs: (r: number) => set(r) && rec.playoff[r] === 1
});

function addLines(model: string, map: string, prob: (r: number) => number, pts?: (r: number) => [number, number]) {
	for (const [setName, set] of [
		['ours', std],
		['oddbot', matched]
	] as const) {
		const s = splits(set);
		lines.push({
			model,
			map,
			set: setName,
			all: scoreProbs(rec, prob, s.all, pts),
			quals: scoreProbs(rec, prob, s.quals, pts),
			playoffs: scoreProbs(rec, prob, s.playoffs, pts)
		});
	}
}

const M = rec.models.length;
const probFns: Record<string, (r: number) => number> = {};
models.forEach((model, k) => {
	const mm: Record<string, Mapping> = {
		train: fitMapping(rec, k, trainRows, FULL_FIT),
		'train simple': fitMapping(rec, k, trainRows, SIMPLE),
		'2026 in-sample': fitMapping(rec, k, stdRows, FULL_FIT)
	};
	if (model instanceof Elo) mm.native = native;
	maps[model.name] = mm;
	const pts = (r: number): [number, number] => {
		const o = (r * M + k) * 5;
		return [rec.pred[o + 3], rec.pred[o + 4]];
	};
	for (const [name, map] of Object.entries(mm)) {
		const prob = (r: number) => probAt(rec, k, r, map);
		if (name === 'train') probFns[model.name] = prob;
		addLines(model.name, name, prob, pts);
	}
});
const oddProb = (r: number) => oddAt.get(r)!.pRed;
lines.push({
	model: 'oddbot EPA (published preds)',
	map: 'theirs',
	set: 'oddbot',
	...(() => {
		const s = splits(matched);
		const pts = (r: number): [number, number] => [oddAt.get(r)!.predRed, oddAt.get(r)!.predBlue];
		return {
			all: scoreProbs(rec, oddProb, s.all, pts),
			quals: scoreProbs(rec, oddProb, s.quals, pts),
			playoffs: scoreProbs(rec, oddProb, s.playoffs, pts)
		};
	})()
});

const pct = (x: number) => (x * 100).toFixed(1).padStart(5);
const b4 = (x: number) => x.toFixed(4);
console.log(
	'model'.padEnd(30),
	'map'.padEnd(15),
	'set'.padEnd(7),
	'n'.padStart(5),
	'brier',
	' accO',
	' accU',
	' qN ',
	'qBrier',
	' qAccO',
	' pN',
	'pBrier',
	' pAccO',
	'  mae'
);
for (const l of lines) {
	console.log(
		l.model.padEnd(30),
		l.map.padEnd(15),
		l.set.padEnd(7),
		String(l.all.n).padStart(5),
		b4(l.all.brier),
		pct(l.all.accOdd),
		pct(l.all.accOurs),
		String(l.quals.n).padStart(4),
		b4(l.quals.brier),
		pct(l.quals.accOdd),
		String(l.playoffs.n).padStart(3),
		b4(l.playoffs.brier),
		pct(l.playoffs.accOdd),
		l.all.mae.toFixed(2).padStart(6)
	);
}

console.log('\npaired brier vs oddbot on matched set (negative = ours better)');
for (const name of ['shipped', 'live-opr best', 'live-opr mean', 'opr-event']) {
	for (const [label, f] of Object.entries(splits(matched))) {
		const d = pairedDiff(rec, probFns[name], oddProb, f);
		console.log(name.padEnd(16), label.padEnd(9), d.diff.toFixed(5), `se ${d.se.toFixed(5)}`);
	}
}

console.log('\noutcome agreement on matched set');
{
	let same = 0;
	let n = 0;
	for (const [r, o] of oddAt) {
		const y = o.redTotal > o.blueTotal ? 1 : o.redTotal < o.blueTotal ? 0 : 0.5;
		n++;
		if (y === rec.outcome[r]) same++;
	}
	console.log(`${same} of ${n} outcomes agree`);
}

console.log('\nby new teams in match (teams with no quals yet at the event), 2026 our set, train mapping');
const groups: [string, Filter][] = [
	['0 new', (r) => std(r) && newTeams[r] === 0],
	['1-2 new', (r) => std(r) && newTeams[r] > 0 && newTeams[r] <= 2],
	['3-4 new', (r) => std(r) && newTeams[r] > 2]
];
for (const [label, f] of groups) {
	const parts = ['shipped', 'opr-event', 'live-opr mean', 'live-opr best', 'live-opr last', 'avg score season'].map(
		(name) => {
			const c = scoreProbs(rec, probFns[name], f);
			return `${name} ${b4(c.brier)}/${pct(c.accOdd)}`;
		}
	);
	const n = scoreProbs(rec, probFns.shipped, f).n;
	console.log(label.padEnd(8), String(n).padStart(5), parts.join(' | '));
}

const oneMore = rowsOf(rec, (r) => std(r) && newTeams[r] === 0);
console.log(`\nmatches with every team already seen at the event: ${oneMore.length} of ${stdRows.length}`);

console.log('\nmatch set');
const raw = await loadSeason(TEST);
let played = 0;
let scored = 0;
for (const e of raw.events) for (const m of e.matches) if (m.played) {
	played++;
	if (m.rs && m.bs) scored++;
}
const prepped = prepSeason(raw).reduce((a, e) => a + e.matches.length, 0);
console.log(`fetched ${raw.fetchedAt}: events ${raw.events.length}, played ${played}, with scores ${scored}, after prep ${prepped}, after warmup ${stdRows.length}`);
const ours = new Set<string>();
for (let r = first.get(TEST)!; r < rec.n; r++) ours.add(rec.keys[r]);
const onlyOdd = [...odd.values()].filter((o) => !ours.has(o.key));
const onlyOurs = [...ours].filter((k) => !odd.has(k));
console.log(`oddbot ${odd.size}, ours (no warmup) ${ours.size}, both ${oddAt.size}, only oddbot ${onlyOdd.length}, only ours ${onlyOurs.length}`);
const byEvent = (keys: string[]) => {
	const out: Record<string, number> = {};
	for (const k of keys) {
		const code = k.split(':')[1];
		out[code] = (out[code] ?? 0) + 1;
	}
	return Object.entries(out).sort((a, b) => b[1] - a[1]);
};
const oddEvents = new Map<string, { type: string; start: string }>();
for (const o of odd.values()) oddEvents.set(o.code, { type: o.type, start: o.start });
const rawEvents = new Map(raw.events.map((e) => [e.code, e]));
console.log(
	'only oddbot by event:',
	byEvent(onlyOdd.map((o) => o.key))
		.slice(0, 25)
		.map(([c, n]) => {
			const e = rawEvents.get(c);
			return `${c}(${n},${oddEvents.get(c)?.start},${e ? `ours:${e.matches.length}` : 'missing'})`;
		})
		.join(' ')
);
console.log('only ours by event:', byEvent(onlyOurs).slice(0, 25).map(([c, n]) => `${c}(${n})`).join(' '));
const types: Record<string, number> = {};
for (const o of odd.values()) types[o.type] = (types[o.type] ?? 0) + 1;
const ourTypes: Record<string, number> = {};
for (const e of raw.events) ourTypes[e.type] = (ourTypes[e.type] ?? 0) + e.matches.filter((m) => m.played).length;
console.log('oddbot types', types, 'our types', ourTypes);

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'audit.json'), `${JSON.stringify({ lines, maps }, null, '\t')}\n`);
