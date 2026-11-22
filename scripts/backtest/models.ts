import type { PEvent, PMatch } from './prep.ts';

export type Ctx = { mean: number; sd: number; day: number };

export type Pred = {
	red: number;
	blue: number;
	varFactor: number;
	redScore: number;
	blueScore: number;
};

export interface Model {
	name: string;
	startSeason(prevRel: Map<number, number>): void;
	startEvent(event: PEvent, ctx: Ctx): void;
	predict(m: PMatch, ctx: Ctx): Pred;
	update(m: PMatch, ctx: Ctx): void;
	endEvent(event: PEvent, ctx: Ctx): void;
	endSeason(): Map<number, number>;
}

export type OprParams = {
	lamNew: number;
	lamPrevSeason: number;
	q: number;
	qMatch: number;
	carry: number;
	drift: number;
	beta: number;
	rhoNew: number;
	rhoPrev: number;
	rhoNewScore?: number;
	rhoPrevScore?: number;
	minMatches: number;
	fallback: 'mean' | 'last' | 'prior';
	sobs: number;
	huber: number;
	qWeek: number;
	history: boolean;
	scoreCommon?: number;
	scoreQ?: number;
};

export type EpaParams = {
	k0: number;
	kMin: number;
	tau: number;
	margin: number;
	carry: number;
	drift: number;
	reset: number;
	beta: number;
	rhoNew: number;
	rhoPrev: number;
	rhoNewScore?: number;
	rhoPrevScore?: number;
	clip: number;
};

type TeamState = {
	mu: number;
	nu: number;
	prec: number;
	meanRef: number;
	rel: number;
	day: number;
};

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

function eventTeams(event: PEvent): number[] {
	const set = new Set<number>();
	for (const m of event.matches) for (const t of [...m.red, ...m.blue]) set.add(t);
	return [...set];
}

function relToMean(mu: number, meanRef: number): number {
	return meanRef > 0 ? mu / (meanRef / 2) : 1;
}

function carried(mu: number, meanRef: number, mean: number, carry: number, drift: number): number {
	const rel = 1 + carry * (relToMean(mu, meanRef) - 1);
	const scale = meanRef > 0 && mean > 0 ? (mean / meanRef) ** drift : 1;
	return rel * (meanRef / 2) * scale;
}

function startRel(
	prev: number | undefined,
	p: { rhoNew: number; rhoPrev: number; rhoNewScore?: number; rhoPrevScore?: number; beta: number }
): { rel: number; relScore: number } {
	if (prev === undefined) return { rel: p.rhoNew, relScore: p.rhoNewScore ?? p.rhoNew };
	const b = p.beta * (prev - 1);
	return { rel: p.rhoPrev + b, relScore: (p.rhoPrevScore ?? p.rhoPrev) + b };
}

export class KalmanOpr implements Model {
	name: string;
	p: OprParams;
	teams = new Map<number, TeamState>();
	prevRel = new Map<number, number>();
	index = new Map<number, number>();
	mu = new Float64Array(0);
	nu = new Float64Array(0);
	prior = new Float64Array(0);
	priorNu = new Float64Array(0);
	P = new Float64Array(0);
	S = new Float64Array(0);
	n = 0;
	played = new Int32Array(0);
	ph = new Float64Array(0);
	sh = new Float64Array(0);

	constructor(name: string, p: OprParams) {
		this.name = name;
		this.p = p;
	}

	startSeason(prevRel: Map<number, number>): void {
		this.teams = new Map();
		this.prevRel = prevRel;
	}

	priorFor(team: number, ctx: Ctx): { mu: number; nu: number; prec: number } {
		const p = this.p;
		const state = p.history ? this.teams.get(team) : undefined;
		if (!state) {
			const prev = this.prevRel.get(team);
			const { rel, relScore } = startRel(prev, p);
			return {
				mu: (ctx.mean / 2) * rel,
				nu: (ctx.mean / 2) * relScore,
				prec: prev === undefined ? p.lamNew : p.lamPrevSeason
			};
		}
		const weeks = Math.max(0, ctx.day - state.day) / 7;
		return {
			mu: carried(state.mu, state.meanRef, ctx.mean, p.carry, p.drift),
			nu: carried(state.nu, state.meanRef, ctx.mean, p.carry, p.drift),
			prec: 1 / (1 / state.prec + p.q + p.qWeek * weeks)
		};
	}

	startEvent(event: PEvent, ctx: Ctx): void {
		const teams = eventTeams(event);
		const n = teams.length;
		this.n = n;
		this.index = new Map(teams.map((t, i) => [t, i]));
		this.mu = new Float64Array(n);
		this.nu = new Float64Array(n);
		this.prior = new Float64Array(n);
		this.priorNu = new Float64Array(n);
		this.P = new Float64Array(n * n);
		this.played = new Int32Array(n);
		this.ph = new Float64Array(n);
		teams.forEach((t, i) => {
			const pr = this.priorFor(t, ctx);
			this.mu[i] = this.prior[i] = pr.mu;
			this.nu[i] = this.priorNu[i] = pr.nu;
			this.P[i * n + i] = 1 / pr.prec;
		});
		if (this.split()) {
			this.S = new Float64Array(n * n).fill(this.p.scoreCommon ?? 0);
			for (let i = 0; i < n; i++) this.S[i * n + i] += this.P[i * n + i];
			this.sh = new Float64Array(n);
		}
	}

	split(): boolean {
		return (this.p.scoreCommon ?? 0) > 0 || (this.p.scoreQ ?? 0) > 0;
	}

	refresh(team: number, ctx: Ctx): void {
		const i = this.index.get(team)!;
		if (this.played[i] > 0) return;
		const pr = this.priorFor(team, ctx);
		this.mu[i] += pr.mu - this.prior[i];
		this.nu[i] += pr.nu - this.priorNu[i];
		this.prior[i] = pr.mu;
		this.priorNu[i] = pr.nu;
	}

	value(team: number, ctx: Ctx, score: boolean): number {
		const i = this.index.get(team)!;
		if (this.played[i] >= this.p.minMatches) return score ? this.nu[i] : this.mu[i];
		if (this.p.fallback === 'mean') return ctx.mean / 2;
		return score ? this.priorNu[i] : this.prior[i];
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		for (const t of m.red) this.refresh(t, ctx);
		for (const t of m.blue) this.refresh(t, ctx);
		let red = 0;
		let blue = 0;
		let redScore = 0;
		let blueScore = 0;
		for (const t of m.red) {
			red += this.value(t, ctx, false);
			redScore += this.value(t, ctx, true);
		}
		for (const t of m.blue) {
			blue += this.value(t, ctx, false);
			blueScore += this.value(t, ctx, true);
		}
		const n = this.n;
		const idx: number[] = [];
		const sign: number[] = [];
		for (const t of m.red) {
			idx.push(this.index.get(t)!);
			sign.push(1);
		}
		for (const t of m.blue) {
			idx.push(this.index.get(t)!);
			sign.push(-1);
		}
		let v = 0;
		for (let a = 0; a < idx.length; a++) {
			for (let b = 0; b < idx.length; b++) v += sign[a] * sign[b] * this.P[idx[a] * n + idx[b]];
		}
		v += this.p.qMatch * idx.length;
		return { red, blue, varFactor: (v + 2) / 2, redScore, blueScore };
	}

	observe(teams: number[], y: number, ctx: Ctx): void {
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
		let s = hph + 1;
		if (Number.isFinite(this.p.huber)) {
			const z = Math.abs(resid) / (this.p.sobs * ctx.sd * Math.sqrt(s));
			if (z > this.p.huber) s = hph + z / this.p.huber;
		}
		for (let k = 0; k < n; k++) this.mu[k] += (this.ph[k] / s) * resid;
		if (!split) for (let k = 0; k < n; k++) this.nu[k] += (this.ph[k] / s) * residNu;
		downdate(this.P, this.ph, n, s);
		if (!split) return;
		const ss = rowSums(this.S, this.sh, n, idx) + 1;
		for (let k = 0; k < n; k++) this.nu[k] += (this.sh[k] / ss) * residNu;
		downdate(this.S, this.sh, n, ss);
	}

	update(m: PMatch, ctx: Ctx): void {
		const n = this.n;
		if (this.p.qMatch > 0) {
			for (const t of [...m.redUpd, ...m.blueUpd]) {
				const i = this.index.get(t)!;
				this.P[i * n + i] += this.p.qMatch;
			}
		}
		const scoreQ = this.p.scoreQ ?? 0;
		if (scoreQ > 0 && this.split()) {
			for (const t of [...m.redUpd, ...m.blueUpd]) {
				const i = this.index.get(t)!;
				this.S[i * n + i] += scoreQ;
			}
		}
		if (m.redOk) this.observe(m.redUpd, m.redNp, ctx);
		if (m.blueOk) this.observe(m.blueUpd, m.blueNp, ctx);
		for (const t of [...m.redUpd, ...m.blueUpd]) this.played[this.index.get(t)!]++;
	}

	endEvent(_event: PEvent, ctx: Ctx): void {
		const n = this.n;
		for (const [team, i] of this.index) {
			if (this.played[i] === 0) continue;
			const usable = this.played[i] >= this.p.minMatches || this.p.fallback !== 'last';
			const mu = usable ? this.mu[i] : this.prior[i];
			const nu = usable ? this.nu[i] : this.priorNu[i];
			this.teams.set(team, {
				mu,
				nu,
				prec: 1 / Math.max(this.P[i * n + i], 1e-9),
				meanRef: ctx.mean,
				rel: relToMean(mu, ctx.mean),
				day: ctx.day
			});
		}
	}

	endSeason(): Map<number, number> {
		return new Map([...this.teams].map(([t, s]) => [t, s.rel]));
	}
}

type EpaState = { r: number; s: number; n: number; meanRef: number; event: string };

export class Epa implements Model {
	name: string;
	p: EpaParams;
	teams = new Map<number, EpaState>();
	prevRel = new Map<number, number>();
	code = '';

	constructor(name: string, p: EpaParams) {
		this.name = name;
		this.p = p;
	}

	startSeason(prevRel: Map<number, number>): void {
		this.teams = new Map();
		this.prevRel = prevRel;
	}

	startEvent(event: PEvent): void {
		this.code = event.code;
	}

	ensure(team: number, ctx: Ctx): EpaState {
		const p = this.p;
		let s = this.teams.get(team);
		if (!s) {
			const { rel, relScore } = startRel(this.prevRel.get(team), p);
			s = {
				r: (ctx.mean / 2) * rel,
				s: (ctx.mean / 2) * relScore,
				n: 0,
				meanRef: ctx.mean,
				event: this.code
			};
			this.teams.set(team, s);
			return s;
		}
		if (s.event !== this.code) {
			s.r = carried(s.r, s.meanRef, ctx.mean, p.carry, p.drift);
			s.s = carried(s.s, s.meanRef, ctx.mean, p.carry, p.drift);
			s.n = Math.floor(s.n * p.reset);
			s.meanRef = ctx.mean;
			s.event = this.code;
		}
		return s;
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		let red = 0;
		let blue = 0;
		let redScore = 0;
		let blueScore = 0;
		for (const t of m.red) {
			const s = this.ensure(t, ctx);
			red += s.r;
			redScore += s.s;
		}
		for (const t of m.blue) {
			const s = this.ensure(t, ctx);
			blue += s.r;
			blueScore += s.s;
		}
		return { red, blue, varFactor: 1, redScore, blueScore };
	}

	k(n: number): number {
		const p = this.p;
		return p.kMin + (p.k0 - p.kMin) * Math.exp(-n / p.tau);
	}

	update(m: PMatch, ctx: Ctx): void {
		const lim = this.p.clip * ctx.sd;
		const clip = (x: number) => (x > lim ? lim : x < -lim ? -lim : x);
		const sumR = (ts: number[]) => ts.reduce((a, t) => a + this.ensure(t, ctx).r, 0);
		const sumS = (ts: number[]) => ts.reduce((a, t) => a + this.ensure(t, ctx).s, 0);
		const redErr = clip(m.redNp - sumR(m.redUpd));
		const blueErr = clip(m.blueNp - sumR(m.blueUpd));
		const redErrS = clip(m.redNp - sumS(m.redUpd));
		const blueErrS = clip(m.blueNp - sumS(m.blueUpd));
		const M = this.p.margin;
		const apply = (
			ts: number[],
			own: number,
			opp: number,
			ownS: number,
			oppS: number,
			ok: boolean
		) => {
			if (!ok || !ts.length) return;
			const delta = (own - M * opp) / (1 + M) / ts.length;
			const deltaS = (ownS - M * oppS) / (1 + M) / ts.length;
			for (const t of ts) {
				const s = this.teams.get(t)!;
				const k = this.k(s.n);
				s.r += k * delta;
				s.s += k * deltaS;
			}
		};
		apply(m.redUpd, redErr, blueErr, redErrS, blueErrS, m.redOk);
		apply(m.blueUpd, blueErr, redErr, blueErrS, redErrS, m.blueOk);
		for (const t of [...m.redUpd, ...m.blueUpd]) {
			const s = this.teams.get(t)!;
			s.n++;
			s.meanRef = ctx.mean;
		}
	}

	endEvent(_event: PEvent, ctx: Ctx): void {
		for (const s of this.teams.values()) if (s.event === this.code) s.meanRef = ctx.mean;
	}

	endSeason(): Map<number, number> {
		return new Map(
			[...this.teams].filter(([, s]) => s.n > 0).map(([t, s]) => [t, relToMean(s.r, s.meanRef)])
		);
	}
}

export class Blend implements Model {
	name: string;
	a: Model;
	b: Model;
	w: number;
	relA = new Map<number, number>();
	relB = new Map<number, number>();

	constructor(name: string, a: Model, b: Model, w: number) {
		this.name = name;
		this.a = a;
		this.b = b;
		this.w = w;
	}

	startSeason(): void {
		this.a.startSeason(this.relA);
		this.b.startSeason(this.relB);
	}

	startEvent(event: PEvent, ctx: Ctx): void {
		this.a.startEvent(event, ctx);
		this.b.startEvent(event, ctx);
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		const x = this.a.predict(m, ctx);
		const y = this.b.predict(m, ctx);
		const w = this.w;
		const mix = (u: number, v: number) => w * u + (1 - w) * v;
		return {
			red: mix(x.red, y.red),
			blue: mix(x.blue, y.blue),
			varFactor: mix(x.varFactor, y.varFactor),
			redScore: mix(x.redScore, y.redScore),
			blueScore: mix(x.blueScore, y.blueScore)
		};
	}

	update(m: PMatch, ctx: Ctx): void {
		this.a.update(m, ctx);
		this.b.update(m, ctx);
	}

	endEvent(event: PEvent, ctx: Ctx): void {
		this.a.endEvent(event, ctx);
		this.b.endEvent(event, ctx);
	}

	endSeason(): Map<number, number> {
		this.relA = this.a.endSeason();
		this.relB = this.b.endSeason();
		return this.relA;
	}
}
