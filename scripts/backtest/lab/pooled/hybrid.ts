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
