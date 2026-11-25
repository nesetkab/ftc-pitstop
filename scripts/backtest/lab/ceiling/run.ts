import { loadSeason } from '../../hist.ts';
import { prepSeason, type PMatch } from '../../prep.ts';

function solve(A: Float64Array, b: Float64Array, n: number): Float64Array {
	const M = A.slice();
	const x = b.slice();
	for (let i = 0; i < n; i++) {
		const p = M[i * n + i];
		for (let j = i + 1; j < n; j++) {
			const f = M[j * n + i] / p;
			if (f === 0) continue;
			for (let k = i; k < n; k++) M[j * n + k] -= f * M[i * n + k];
			x[j] -= f * x[i];
		}
	}
	for (let i = n - 1; i >= 0; i--) {
		let s = x[i];
		for (let k = i + 1; k < n; k++) s -= M[i * n + k] * x[k];
		x[i] = s / M[i * n + i];
	}
	return x;
}

const season = Number(process.argv[2] ?? 2026);
const lam = Number(process.argv[3] ?? 0.5);
const events = prepSeason(await loadSeason(season));
const tally = { all: [0, 0], quals: [0, 0], playoffs: [0, 0], allIn: [0, 0] };
for (const e of events) {
	const teams = [...new Set(e.matches.flatMap((m) => [...m.red, ...m.blue]))];
	const at = new Map(teams.map((t, i) => [t, i]));
	const n = teams.length;
	const obs: [number[], number][] = [];
	for (const m of e.matches) {
		if (m.redOk) obs.push([m.redUpd.map((t) => at.get(t)!), m.redNp]);
		if (m.blueOk) obs.push([m.blueUpd.map((t) => at.get(t)!), m.blueNp]);
	}
	if (obs.length < 8) continue;
	const mean = obs.reduce((s, o) => s + o[1], 0) / obs.length / 2;
	const build = (skip: PMatch | null) => {
		const A = new Float64Array(n * n);
		const b = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			A[i * n + i] = lam;
			b[i] = lam * mean;
		}
		for (const m of e.matches) {
			if (m === skip) continue;
			for (const [ok, ts, y] of [
				[m.redOk, m.redUpd, m.redNp],
				[m.blueOk, m.blueUpd, m.blueNp]
			] as const) {
				if (!ok) continue;
				const idx = ts.map((t) => at.get(t)!);
				for (const i of idx) {
					b[i] += y;
					for (const j of idx) A[i * n + j] += 1;
				}
			}
		}
		return solve(A, b, n);
	};
	const full = build(null);
	for (const m of e.matches) {
		const y = m.redTotal > m.blueTotal ? 1 : m.redTotal < m.blueTotal ? 0 : 0.5;
		if (y === 0.5) continue;
		const loo = build(m);
		const side = (o: Float64Array, ts: number[]) => ts.reduce((s, t) => s + o[at.get(t)!], 0);
		const hit = (o: Float64Array) => (side(o, m.red) > side(o, m.blue) === (y === 1) ? 1 : 0);
		const k = m.playoff ? 'playoffs' : 'quals';
		tally.all[0] += hit(loo);
		tally.all[1]++;
		tally[k][0] += hit(loo);
		tally[k][1]++;
		tally.allIn[0] += hit(full);
		tally.allIn[1]++;
	}
}
const pct = ([a, b]: number[]) => `${((100 * a) / b).toFixed(1)}% of ${b}`;
console.log(season, 'lam', lam);
console.log(
	'leave this match out:',
	pct(tally.all),
	'| quals',
	pct(tally.quals),
	'| playoffs',
	pct(tally.playoffs)
);
console.log('match included (cheating):', pct(tally.allIn));
