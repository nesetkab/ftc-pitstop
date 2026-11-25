import type { Ctx, Model, Pred } from '../../models.ts';
import type { PEvent, PMatch } from '../../prep.ts';

export type PooledParams = {
	lamNew: number;
	lamPrev: number;
	rhoNew: number;
	rhoPrev: number;
	beta: number;
	beta2: number;
	rhoNewScore: number;
	rhoPrevScore: number;
	halfLife: number;
	drift: number;
	playoffW: number;
	offW: number;
	penW: number;
	penLam: number;
	huberEvent: number;
	sobs: number;
	qMatch: number;
	hetero: number;
	heteroPool: number;
	kappa: number;
	block: boolean;
	q: number;
	qWeek: number;
	target: 'np' | 'total';
	huber: number;
	scoreCommon: number;
	scoreQ: number;
	lamDecay: boolean;
	tol: number;
};

export const POOLED_BASE: PooledParams = {
	lamNew: 2,
	lamPrev: 2,
	rhoNew: 0.2,
	rhoPrev: 0.4,
	beta: 0.5,
	beta2: 0,
	rhoNewScore: 0.5,
	rhoPrevScore: 0.7,
	halfLife: Infinity,
	drift: 0.25,
	playoffW: 1,
	offW: 1,
	penW: 0,
	penLam: 10,
	huberEvent: Infinity,
	sobs: 0.8,
	qMatch: 0,
	hetero: 0,
	heteroPool: 0,
	kappa: 1,
	block: true,
	q: 0,
	qWeek: 0,
	target: 'np',
	huber: Infinity,
	scoreCommon: 0.1,
	scoreQ: 0.05,
	lamDecay: false,
	tol: 1e-6
};

type Pending = {
	end: number;
	day: number;
	mean: number;
	po: number;
	teams: number[];
	y: number;
	pen: number;
};

const LN2 = Math.LN2;

function grow<T extends Float64Array | Int32Array | Uint8Array>(arr: T, size: number): T {
	if (size <= arr.length) return arr;
	const Ctor = arr.constructor as new (n: number) => T;
	const out = new Ctor(Math.max(size, arr.length * 2));
	out.set(arr);
	return out;
}

function dayNumber(date: string): number {
	return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

function eventTeams(event: PEvent): number[] {
	const set = new Set<number>();
	for (const m of event.matches) for (const t of [...m.red, ...m.blue]) set.add(t);
	return [...set];
}

function invertSpd(H: Float64Array, n: number): Float64Array {
	const L = new Float64Array(n * n);
	for (let j = 0; j < n; j++) {
		let s = H[j * n + j];
		for (let k = 0; k < j; k++) s -= L[j * n + k] ** 2;
		const d = Math.sqrt(Math.max(s, 1e-12));
		L[j * n + j] = d;
		for (let i = j + 1; i < n; i++) {
			let t = H[i * n + j];
			for (let k = 0; k < j; k++) t -= L[i * n + k] * L[j * n + k];
			L[i * n + j] = t / d;
		}
	}
	const Linv = new Float64Array(n * n);
	for (let j = 0; j < n; j++) {
		Linv[j * n + j] = 1 / L[j * n + j];
		for (let i = j + 1; i < n; i++) {
			let t = 0;
			for (let k = j; k < i; k++) t -= L[i * n + k] * Linv[k * n + j];
			Linv[i * n + j] = t / L[i * n + i];
		}
	}
	const out = new Float64Array(n * n);
	for (let i = 0; i < n; i++) {
		for (let j = 0; j <= i; j++) {
			let t = 0;
			for (let k = i; k < n; k++) t += Linv[k * n + i] * Linv[k * n + j];
			out[i * n + j] = t;
			out[j * n + i] = t;
		}
	}
	return out;
}

function rowSums(P: Float64Array, ph: Float64Array, n: number, idx: number[]): number {
	ph.fill(0);
	for (const i of idx) {
		const row = i * n;
		for (let k = 0; k < n; k++) ph[k] += P[row + k];
	}
	let hph = 0;
	for (const i of idx) hph += ph[i];
	return hph;
}

function downdate(P: Float64Array, ph: Float64Array, n: number, s: number): void {
	for (let a = 0; a < n; a++) {
		const fa = ph[a] / s;
		if (fa === 0) continue;
		const row = a * n;
		for (let b = 0; b < n; b++) P[row + b] -= fa * ph[b];
	}
}

export class PooledOpr implements Model {
	name: string;
	p: PooledParams;
	history: Map<number, number>[] = [];
	ids = new Map<number, number>();
	rel: number[] = [];
	relScore: number[] = [];
	lam: number[] = [];
	teamRows: number[][] = [];
	lastDay: number[] = [];
	x = new Float64Array(0);
	xs = new Float64Array(0);
	rows = 0;
	ra = new Int32Array(1024);
	rb = new Int32Array(1024);
	ry = new Float64Array(1024);
	rpen = new Float64Array(1024);
	c = new Float64Array(0);
	penPrior = 0;
	rday = new Int32Array(1024);
	rmean = new Float64Array(1024);
	rpo = new Uint8Array(1024);
	w = new Float64Array(0);
	diag = new Float64Array(0);
	pending: Pending[] = [];
	solvedDay = -Infinity;
	solveMean = 0;
	lastCtx: Ctx = { mean: 0, sd: 1, day: 0 };
	iters = 0;
	index = new Map<number, number>();
	n = 0;
	gidx: number[] = [];
	hist: boolean[] = [];
	mu = new Float64Array(0);
	nu = new Float64Array(0);
	base = new Float64Array(0);
	baseNu = new Float64Array(0);
	P = new Float64Array(0);
	S = new Float64Array(0);
	played = new Int32Array(0);
	ph = new Float64Array(0);
	sh = new Float64Array(0);

	constructor(name: string, p: PooledParams) {
		this.name = name;
		this.p = p;
	}

	startSeason(prevRel: Map<number, number>): void {
		this.history.unshift(prevRel);
		this.history.length = Math.min(this.history.length, 3);
		this.ids = new Map();
		this.rel = [];
		this.relScore = [];
		this.lam = [];
		this.teamRows = [];
		this.lastDay = [];
		this.x = new Float64Array(0);
		this.xs = new Float64Array(0);
		this.c = new Float64Array(0);
		this.rows = 0;
		this.pending = [];
		this.solvedDay = -Infinity;
		this.solveMean = 0;
		this.lastSolveMean = 0;
	}

	ensure(team: number): number {
		let i = this.ids.get(team);
		if (i !== undefined) return i;
		const p = this.p;
		i = this.ids.size;
		this.ids.set(team, i);
		const r1 = this.history[0]?.get(team);
		if (r1 === undefined) {
			this.rel.push(p.rhoNew);
			this.relScore.push(p.rhoNewScore);
			this.lam.push(p.lamNew);
		} else {
			let b = p.beta * (r1 - 1);
			const r2 = this.history[1]?.get(team);
			if (r2 !== undefined) b += p.beta2 * (r2 - 1);
			this.rel.push(p.rhoPrev + b);
			this.relScore.push(p.rhoPrevScore + b);
			this.lam.push(p.lamPrev);
		}
		this.teamRows.push([]);
		this.lastDay.push(-Infinity);
		return i;
	}

	commit(day: number, all: boolean): boolean {
		let changed = false;
		const keep: Pending[] = [];
		for (const r of this.pending) {
			if (!all && r.end >= day) {
				keep.push(r);
				continue;
			}
			changed = true;
			const k = this.rows++;
			const size = this.rows;
			this.ra = grow(this.ra, size);
			this.rb = grow(this.rb, size);
			this.ry = grow(this.ry, size);
			this.rpen = grow(this.rpen, size);
			this.rday = grow(this.rday, size);
			this.rmean = grow(this.rmean, size);
			this.rpo = grow(this.rpo, size);
			const a = this.ids.get(r.teams[0])!;
			const b = r.teams.length > 1 ? this.ids.get(r.teams[1])! : -1;
			this.ra[k] = a;
			this.rb[k] = b;
			this.ry[k] = r.y;
			this.rpen[k] = r.pen;
			this.rday[k] = r.day;
			this.rmean[k] = r.mean;
			this.rpo[k] = r.po;
			this.teamRows[a].push(k);
			this.lastDay[a] = Math.max(this.lastDay[a], r.day);
			if (b >= 0) {
				this.teamRows[b].push(k);
				this.lastDay[b] = Math.max(this.lastDay[b], r.day);
			}
		}
		this.pending = keep;
		return changed;
	}

	matvec(v: Float64Array, out: Float64Array, lam: Float64Array): void {
		const N = v.length;
		for (let t = 0; t < N; t++) out[t] = lam[t] * v[t];
		const { ra, rb, w } = this;
		for (let r = 0; r < this.rows; r++) {
			const a = ra[r];
			const b = rb[r];
			const s = w[r] * (b >= 0 ? v[a] + v[b] : v[a]);
			out[a] += s;
			if (b >= 0) out[b] += s;
		}
	}

	pcg(lam: Float64Array, rhs: Float64Array, x: Float64Array): void {
		const N = x.length;
		const r = new Float64Array(N);
		const z = new Float64Array(N);
		const d = new Float64Array(N);
		const Ad = new Float64Array(N);
		this.matvec(x, Ad, lam);
		let bnorm = 0;
		for (let t = 0; t < N; t++) {
			r[t] = rhs[t] - Ad[t];
			z[t] = r[t] / this.diag[t];
			d[t] = z[t];
			bnorm += rhs[t] * rhs[t];
		}
		bnorm = Math.sqrt(bnorm) || 1;
		let rz = 0;
		for (let t = 0; t < N; t++) rz += r[t] * z[t];
		for (let it = 0; it < 500; it++) {
			let rn = 0;
			for (let t = 0; t < N; t++) rn += r[t] * r[t];
			if (Math.sqrt(rn) < this.p.tol * bnorm) break;
			this.iters++;
			this.matvec(d, Ad, lam);
			let dAd = 0;
			for (let t = 0; t < N; t++) dAd += d[t] * Ad[t];
			const alpha = rz / dAd;
			let rzNew = 0;
			for (let t = 0; t < N; t++) {
				x[t] += alpha * d[t];
				r[t] -= alpha * Ad[t];
				z[t] = r[t] / this.diag[t];
				rzNew += r[t] * z[t];
			}
			const beta = rzNew / rz;
			rz = rzNew;
			for (let t = 0; t < N; t++) d[t] = z[t] + beta * d[t];
		}
	}

	solve(day: number, ctx: Ctx, all = false): void {
		this.commit(day, all);
		this.solvedDay = day;
		this.solveMean = ctx.mean;
		const p = this.p;
		const N = this.ids.size;
		const half = ctx.mean / 2;
		const prevX = this.x;
		const prevXs = this.xs;
		const prevMean = this.lastSolveMean;
		this.x = new Float64Array(N);
		this.xs = new Float64Array(N);
		const lam = new Float64Array(N);
		for (let t = 0; t < N; t++) {
			const lt = this.lam[t];
			if (p.lamDecay && this.lastDay[t] > -Infinity && Number.isFinite(p.halfLife))
				lam[t] = lt * 0.5 ** ((day - this.lastDay[t]) / p.halfLife);
			else lam[t] = lt;
			const scale = prevMean > 0 ? (ctx.mean / prevMean) ** p.drift : 1;
			this.x[t] = t < prevX.length ? prevX[t] * scale : half * this.rel[t];
			this.xs[t] = t < prevXs.length ? prevXs[t] * scale : half * this.relScore[t];
		}
		this.lastSolveMean = ctx.mean;
		const R = this.rows;
		this.w = new Float64Array(R);
		const ys = new Float64Array(R);
		const decay = Number.isFinite(p.halfLife) ? LN2 / p.halfLife : 0;
		const robust = new Float64Array(R).fill(1);
		const passes = Number.isFinite(p.huber) ? 3 : 1;
		for (let pass = 0; pass < passes; pass++) {
			for (let r = 0; r < R; r++) {
				let w = decay > 0 ? Math.exp(-decay * (day - this.rday[r])) : 1;
				if (this.rpo[r] & 1) w *= p.playoffW;
				if (this.rpo[r] & 2) w *= p.offW;
				if (p.heteroPool !== 0 && ctx.mean > 0) {
					const a = this.ra[r];
					const b = this.rb[r];
					const lvl = (this.xs[a] + (b >= 0 ? this.xs[b] : 0)) / ctx.mean;
					w /= Math.min(Math.max(lvl, 0.25), 4) ** p.heteroPool;
				}
				this.w[r] = w * robust[r];
				const m = this.rmean[r];
				ys[r] = m > 0 && ctx.mean > 0 ? this.ry[r] * (ctx.mean / m) ** p.drift : this.ry[r];
			}
			this.diag = new Float64Array(N);
			const rhs = new Float64Array(N);
			const rhsS = new Float64Array(N);
			for (let t = 0; t < N; t++) {
				this.diag[t] = lam[t];
				rhs[t] = lam[t] * half * this.rel[t];
				rhsS[t] = lam[t] * half * this.relScore[t];
			}
			for (let r = 0; r < R; r++) {
				const a = this.ra[r];
				const b = this.rb[r];
				const wy = this.w[r] * ys[r];
				this.diag[a] += this.w[r];
				rhs[a] += wy;
				rhsS[a] += wy;
				if (b >= 0) {
					this.diag[b] += this.w[r];
					rhs[b] += wy;
					rhsS[b] += wy;
				}
			}
			this.pcg(lam, rhs, this.x);
			this.pcg(lam, rhsS, this.xs);
			if (pass === passes - 1 && p.penW > 0) this.solvePen(N);
			if (pass === passes - 1) break;
			let sw = 0;
			let swr = 0;
			const res = new Float64Array(R);
			for (let r = 0; r < R; r++) {
				const a = this.ra[r];
				const b = this.rb[r];
				res[r] = ys[r] - this.x[a] - (b >= 0 ? this.x[b] : 0);
				const w = this.w[r] / robust[r];
				sw += w;
				swr += w * res[r] * res[r];
			}
			const sigma = Math.sqrt(swr / Math.max(sw, 1e-9));
			for (let r = 0; r < R; r++) {
				const z = Math.abs(res[r]) / (p.huber * sigma);
				robust[r] = z > 1 ? 1 / z : 1;
			}
		}
	}

	solvePen(N: number): void {
		const R = this.rows;
		let sw = 0;
		let sp = 0;
		for (let r = 0; r < R; r++) {
			sw += this.w[r];
			sp += this.w[r] * this.rpen[r];
		}
		this.penPrior = sw > 0 ? sp / sw / 2 : 0;
		const lam = new Float64Array(N).fill(this.p.penLam);
		const rhs = new Float64Array(N).fill(this.p.penLam * this.penPrior);
		const diag = new Float64Array(N).fill(this.p.penLam);
		for (let r = 0; r < R; r++) {
			const a = this.ra[r];
			const b = this.rb[r];
			const wp = this.w[r] * this.rpen[r];
			diag[a] += this.w[r];
			rhs[a] += wp;
			if (b >= 0) {
				diag[b] += this.w[r];
				rhs[b] += wp;
			}
		}
		const saved = this.diag;
		this.diag = diag;
		const c = new Float64Array(N);
		for (let t = 0; t < N; t++) c[t] = t < this.c.length ? this.c[t] : this.penPrior;
		this.pcg(lam, rhs, c);
		this.c = c;
		this.diag = saved;
	}

	pen(team: number): number {
		const g = this.ids.get(team)!;
		return g < this.c.length ? this.c[g] : this.penPrior;
	}

	lastSolveMean = 0;

	extend(): void {
		const N = this.ids.size;
		const old = this.x.length;
		if (old >= N) return;
		const half = this.solveMean / 2;
		const x = new Float64Array(N);
		const xs = new Float64Array(N);
		const diag = new Float64Array(N);
		x.set(this.x);
		xs.set(this.xs);
		diag.set(this.diag);
		for (let t = old; t < N; t++) {
			x[t] = half * this.rel[t];
			xs[t] = half * this.relScore[t];
			diag[t] = this.lam[t];
		}
		this.x = x;
		this.xs = xs;
		this.diag = diag;
	}

	startEvent(event: PEvent, ctx: Ctx): void {
		const p = this.p;
		const teams = eventTeams(event);
		for (const t of teams) this.ensure(t);
		this.currentEnd = dayNumber(event.end);
		this.currentOfficial = event.official;
		if (ctx.day > this.solvedDay) this.solve(ctx.day, ctx);
		else this.extend();
		const n = teams.length;
		this.n = n;
		this.index = new Map(teams.map((t, i) => [t, i]));
		this.gidx = teams.map((t) => this.ids.get(t)!);
		this.hist = this.gidx.map((g) => this.teamRows[g].length > 0);
		this.mu = new Float64Array(n);
		this.nu = new Float64Array(n);
		this.base = new Float64Array(n);
		this.baseNu = new Float64Array(n);
		this.played = new Int32Array(n);
		this.ph = new Float64Array(n);
		this.sh = new Float64Array(n);
		const local = new Map(this.gidx.map((g, i) => [g, i]));
		let P: Float64Array;
		if (p.block) {
			const H = new Float64Array(n * n);
			for (let i = 0; i < n; i++) {
				const g = this.gidx[i];
				H[i * n + i] = this.diag[g];
				for (const r of this.teamRows[g]) {
					const other = this.ra[r] === g ? this.rb[r] : this.ra[r];
					if (other < 0) continue;
					const j = local.get(other);
					if (j !== undefined) H[i * n + j] += this.w[r];
				}
			}
			P = invertSpd(H, n);
		} else {
			P = new Float64Array(n * n);
			for (let i = 0; i < n; i++) {
				const g = this.gidx[i];
				P[i * n + i] = 1 / (this.diag[g]);
			}
		}
		if (p.kappa !== 1) {
			const k = this.hist.map((h) => (h ? Math.sqrt(p.kappa) : 1));
			for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) P[i * n + j] *= k[i] * k[j];
		}
		for (let i = 0; i < n; i++) {
			if (!this.hist[i]) continue;
			const weeks = Math.max(0, ctx.day - this.lastDay[this.gidx[i]]) / 7;
			P[i * n + i] += p.q + p.qWeek * weeks;
		}
		this.P = P;
		for (let i = 0; i < n; i++) {
			const v = this.prior(i, ctx);
			this.mu[i] = this.base[i] = v.mu;
			this.nu[i] = this.baseNu[i] = v.nu;
		}
		if (this.split()) {
			this.S = new Float64Array(n * n);
			for (let k = 0; k < n * n; k++) this.S[k] = P[k] + p.scoreCommon;
		}
	}

	prior(i: number, ctx: Ctx): { mu: number; nu: number } {
		const g = this.gidx[i];
		if (!this.hist[i])
			return { mu: (ctx.mean / 2) * this.rel[g], nu: (ctx.mean / 2) * this.relScore[g] };
		const scale = this.solveMean > 0 && ctx.mean > 0 ? (ctx.mean / this.solveMean) ** this.p.drift : 1;
		return { mu: this.x[g] * scale, nu: this.xs[g] * scale };
	}

	split(): boolean {
		return this.p.scoreCommon > 0 || this.p.scoreQ > 0;
	}

	refresh(team: number, ctx: Ctx): void {
		const i = this.index.get(team)!;
		if (this.played[i] > 0) return;
		const v = this.prior(i, ctx);
		this.mu[i] += v.mu - this.base[i];
		this.nu[i] += v.nu - this.baseNu[i];
		this.base[i] = v.mu;
		this.baseNu[i] = v.nu;
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		for (const t of m.red) this.refresh(t, ctx);
		for (const t of m.blue) this.refresh(t, ctx);
		const n = this.n;
		const idx: number[] = [];
		const sign: number[] = [];
		let red = 0;
		let blue = 0;
		let redScore = 0;
		let blueScore = 0;
		for (const t of m.red) {
			const i = this.index.get(t)!;
			red += this.mu[i];
			redScore += this.nu[i];
			idx.push(i);
			sign.push(1);
		}
		for (const t of m.blue) {
			const i = this.index.get(t)!;
			blue += this.mu[i];
			blueScore += this.nu[i];
			idx.push(i);
			sign.push(-1);
		}
		if (this.p.penW > 0) {
			for (const t of m.red) blue += this.p.penW * this.pen(t);
			for (const t of m.blue) red += this.p.penW * this.pen(t);
		}
		let v = 0;
		for (let a = 0; a < idx.length; a++)
			for (let b = 0; b < idx.length; b++) v += sign[a] * sign[b] * this.P[idx[a] * n + idx[b]];
		return { red, blue, varFactor: (v + 2) / 2, redScore, blueScore };
	}

	observe(teams: number[], y: number, base: number, ctx: Ctx): void {
		const n = this.n;
		const split = this.split();
		const idx = teams.map((t) => this.index.get(t)!);
		const hph = rowSums(this.P, this.ph, n, idx);
		let pred = 0;
		let predNu = 0;
		for (const i of idx) {
			pred += this.mu[i];
			predNu += this.nu[i];
		}
		const resid = y - pred;
		const residNu = y - predNu;
		const p = this.p;
		let noise = base;
		if (p.hetero !== 0 && ctx.mean > 0)
			noise *= Math.min(Math.max(predNu / ctx.mean, 0.25), 4) ** p.hetero;
		if (Number.isFinite(p.huberEvent)) {
			const z = Math.abs(resid) / (p.sobs * ctx.sd * Math.sqrt(hph + noise));
			if (z > p.huberEvent) noise *= z / p.huberEvent;
		}
		const s = hph + noise;
		for (let k = 0; k < n; k++) this.mu[k] += (this.ph[k] / s) * resid;
		if (!split) for (let k = 0; k < n; k++) this.nu[k] += (this.ph[k] / s) * residNu;
		downdate(this.P, this.ph, n, s);
		if (!split) return;
		const ss = rowSums(this.S, this.sh, n, idx) + noise;
		for (let k = 0; k < n; k++) this.nu[k] += (this.sh[k] / ss) * residNu;
		downdate(this.S, this.sh, n, ss);
	}

	target(m: PMatch, red: boolean): number {
		if (this.p.target === 'total') return red ? m.redTotal : m.blueTotal;
		return red ? m.redNp : m.blueNp;
	}

	currentEnd = 0;
	currentOfficial = true;

	update(m: PMatch, ctx: Ctx): void {
		const n = this.n;
		const p = this.p;
		if (p.scoreQ > 0 && this.split()) {
			for (const t of [...m.redUpd, ...m.blueUpd]) {
				const i = this.index.get(t)!;
				this.S[i * n + i] += p.scoreQ;
			}
		}
		if (p.qMatch > 0) {
			for (const t of [...m.redUpd, ...m.blueUpd]) {
				const i = this.index.get(t)!;
				this.P[i * n + i] += p.qMatch;
			}
		}
		const flags = (m.playoff ? 1 : 0) | (this.currentOfficial ? 0 : 2);
		const noise = 1 / ((m.playoff ? p.playoffW : 1) * (this.currentOfficial ? 1 : p.offW));
		for (const [ok, teams, red] of [
			[m.redOk, m.redUpd, true],
			[m.blueOk, m.blueUpd, false]
		] as const) {
			if (!ok) continue;
			const y = this.target(m, red);
			if (Number.isFinite(noise)) this.observe(teams, y, noise, ctx);
			this.pending.push({
				end: this.currentEnd,
				day: ctx.day,
				mean: ctx.mean,
				po: flags,
				teams: teams.slice(0, 2),
				y,
				pen: Math.max(0, red ? m.blueTotal - m.blueNp : m.redTotal - m.redNp)
			});
		}
		for (const t of [...m.redUpd, ...m.blueUpd]) this.played[this.index.get(t)!]++;
	}

	endEvent(_event: PEvent, ctx: Ctx): void {
		this.lastCtx = ctx;
	}

	endSeason(): Map<number, number> {
		this.solve(this.lastCtx.day + 1, this.lastCtx, true);
		const half = this.lastCtx.mean / 2;
		const out = new Map<number, number>();
		for (const [team, g] of this.ids) {
			if (this.teamRows[g].length === 0) continue;
			out.set(team, half > 0 ? this.x[g] / half : 1);
		}
		return out;
	}
}
