import type { Match } from '../../src/lib/types.ts';

export function solve(a: number[][], b: number[]): number[] {
	const n = b.length;
	const m = a.map((row, i) => [...row, b[i]]);
	for (let col = 0; col < n; col++) {
		let pivot = col;
		for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
		[m[col], m[pivot]] = [m[pivot], m[col]];
		for (let r = 0; r < n; r++) {
			if (r === col || m[col][col] === 0) continue;
			const f = m[r][col] / m[col][col];
			for (let k = col; k <= n; k++) m[r][k] -= f * m[col][k];
		}
	}
	return m.map((row, i) => (row[i] === 0 ? 0 : row[n] / row[i]));
}

export function leastSquaresOpr(matches: Match[], score: 'np' | 'total'): Map<number, number> {
	const teams = [...new Set(matches.flatMap((m) => [...m.red, ...m.blue].map((t) => t.team)))];
	const index = new Map(teams.map((t, i) => [t, i]));
	const n = teams.length;
	const ata = Array.from({ length: n }, () => new Array<number>(n).fill(0));
	const atb = new Array<number>(n).fill(0);
	for (const match of matches) {
		for (const side of ['red', 'blue'] as const) {
			const result = match.result?.[side];
			if (!result) continue;
			const y = score === 'np' ? result.preFoulTotal : result.total;
			const rows = match[side].map((t) => index.get(t.team)!);
			for (const i of rows) {
				atb[i] += y;
				for (const j of rows) ata[i][j] += 1;
			}
		}
	}
	for (let i = 0; i < n; i++) ata[i][i] += 1e-9;
	const x = solve(ata, atb);
	return new Map(teams.map((t, i) => [t, x[i]]));
}

export function summarize(pairs: { a: number; b: number }[]) {
	if (!pairs.length) return null;
	const diffs = pairs.map((p) => p.a - p.b);
	const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
	const round = (x: number) => Math.round(x * 100) / 100;
	return {
		n: pairs.length,
		meanDiff: round(mean(diffs)),
		meanAbsDiff: round(mean(diffs.map(Math.abs))),
		maxAbsDiff: round(Math.max(...diffs.map(Math.abs))),
		correlation: round(pearson(pairs.map((p) => [p.a, p.b])))
	};
}

export function pearson(pairs: number[][]): number {
	const n = pairs.length;
	const ma = pairs.reduce((s, p) => s + p[0], 0) / n;
	const mb = pairs.reduce((s, p) => s + p[1], 0) / n;
	let sab = 0;
	let saa = 0;
	let sbb = 0;
	for (const [a, b] of pairs) {
		sab += (a - ma) * (b - mb);
		saa += (a - ma) ** 2;
		sbb += (b - mb) ** 2;
	}
	return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

function ranks(values: number[]): number[] {
	const order = values.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
	const out = new Array<number>(values.length);
	order.forEach(([, i], r) => (out[i] = r));
	return out;
}

export function spearman(pairs: number[][]): number {
	if (pairs.length < 2) return 1;
	const a = ranks(pairs.map((p) => p[0]));
	const b = ranks(pairs.map((p) => p[1]));
	return Math.round(pearson(a.map((x, i) => [x, b[i]])) * 1000) / 1000;
}
