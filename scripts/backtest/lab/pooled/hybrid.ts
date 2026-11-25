import { KalmanOpr, type Ctx, type Model, type OprParams, type Pred } from '../../models.ts';
import type { PEvent, PMatch } from '../../prep.ts';
import { PooledOpr } from './model.ts';

export class PooledPriorOpr extends KalmanOpr {
	pooled: PooledOpr;
	mix: number;
	pooledRel = new Map<number, number>();

	constructor(name: string, p: OprParams, pooled: PooledOpr, mix: number) {
		super(name, p);
		this.pooled = pooled;
		this.mix = mix;
	}

	startSeason(prevRel: Map<number, number>): void {
		super.startSeason(prevRel);
		this.pooled.startSeason(this.pooledRel);
	}

	priorFor(team: number, ctx: Ctx): { mu: number; nu: number; prec: number } {
		const base = super.priorFor(team, ctx);
		const pooled = this.pooled;
		const g = pooled.ids.get(team);
		if (!this.teams.has(team) || g === undefined || pooled.teamRows[g].length === 0) return base;
		const scale =
			pooled.solveMean > 0 && ctx.mean > 0 ? (ctx.mean / pooled.solveMean) ** pooled.p.drift : 1;
		const w = this.mix;
		return {
			mu: w * pooled.x[g] * scale + (1 - w) * base.mu,
			nu: w * pooled.xs[g] * scale + (1 - w) * base.nu,
			prec: base.prec
		};
	}

	startEvent(event: PEvent, ctx: Ctx): void {
		this.pooled.startEvent(event, ctx);
		super.startEvent(event, ctx);
	}

	update(m: PMatch, ctx: Ctx): void {
		super.update(m, ctx);
		this.pooled.update(m, ctx);
	}

	endEvent(event: PEvent, ctx: Ctx): void {
		super.endEvent(event, ctx);
		this.pooled.endEvent(event, ctx);
	}

	endSeason(): Map<number, number> {
		this.pooledRel = this.pooled.endSeason();
		return super.endSeason();
	}
}

export class HeteroOpr extends KalmanOpr {
	hetero: number;

	constructor(name: string, p: OprParams, hetero: number) {
		super(name, p);
		this.hetero = hetero;
	}

	observe(teams: number[], y: number, ctx: Ctx): void {
		const n = this.n;
		const split = this.split();
		const idx = teams.map((t) => this.index.get(t)!);
		const ph = this.ph;
		ph.fill(0);
		for (const i of idx) for (let k = 0; k < n; k++) ph[k] += this.P[i * n + k];
		let hph = 0;
		let pred = 0;
		let predNu = 0;
		for (const i of idx) {
			hph += ph[i];
			pred += this.mu[i];
			predNu += this.nu[i];
		}
		const noise =
			ctx.mean > 0 ? Math.min(Math.max(predNu / ctx.mean, 0.25), 4) ** this.hetero : 1;
		const s = hph + noise;
		const resid = y - pred;
		const residNu = y - predNu;
		for (let k = 0; k < n; k++) this.mu[k] += (ph[k] / s) * resid;
		if (!split) for (let k = 0; k < n; k++) this.nu[k] += (ph[k] / s) * residNu;
		for (let a = 0; a < n; a++) {
			const fa = ph[a] / s;
			if (fa === 0) continue;
			for (let b = 0; b < n; b++) this.P[a * n + b] -= fa * ph[b];
		}
		if (!split) return;
		const sh = this.sh;
		sh.fill(0);
		for (const i of idx) for (let k = 0; k < n; k++) sh[k] += this.S[i * n + k];
		let ss = noise;
		for (const i of idx) ss += sh[i];
		for (let k = 0; k < n; k++) this.nu[k] += (sh[k] / ss) * residNu;
		for (let a = 0; a < n; a++) {
			const fa = sh[a] / ss;
			if (fa === 0) continue;
			for (let b = 0; b < n; b++) this.S[a * n + b] -= fa * sh[b];
		}
	}
}

export class PlayoffShift implements Model {
	name: string;
	inner: Model;
	shift: number;

	constructor(name: string, inner: Model, shift: number) {
		this.name = name;
		this.inner = inner;
		this.shift = shift;
	}

	startSeason(prevRel: Map<number, number>): void {
		this.inner.startSeason(prevRel);
	}

	startEvent(event: PEvent, ctx: Ctx): void {
		this.inner.startEvent(event, ctx);
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		const p = this.inner.predict(m, ctx);
		if (!m.playoff) return p;
		const d = this.shift * ctx.sd;
		return { ...p, red: p.red + d / 2, blue: p.blue - d / 2 };
	}

	update(m: PMatch, ctx: Ctx): void {
		this.inner.update(m, ctx);
	}

	endEvent(event: PEvent, ctx: Ctx): void {
		this.inner.endEvent(event, ctx);
	}

	endSeason(): Map<number, number> {
		return this.inner.endSeason();
	}
}
