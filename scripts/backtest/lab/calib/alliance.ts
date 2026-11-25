import type { Ctx } from './lib.ts';
import { sigmoid } from './lib.ts';

export type CarryFloor = {
	kappa: number;
	eta: number;
	gamma: number;
	carry: number;
	floor: number;
	width: number;
};

export const CARRY_FLOOR: CarryFloor = {
	kappa: Math.exp(-0.987),
	eta: Math.exp(-1.362),
	gamma: 0.538,
	carry: 0.076,
	floor: 0.258,
	width: Math.exp(-1.843)
};

export const softFloor = (v: number, floor: number, w: number) => {
	const t = (v - floor) / w;
	return floor + w * (t > 30 ? t : Math.log1p(Math.exp(t)));
};

export function allianceMargin(
	hi: [number, number],
	lo: [number, number],
	half: number,
	p: Pick<CarryFloor, 'carry' | 'floor' | 'width'>
): number {
	const f = (v: number) => softFloor(v / half, p.floor, p.width);
	const rh = f(hi[0]);
	const rl = f(lo[0]);
	const bh = f(hi[1]);
	const bl = f(lo[1]);
	return (rh + rl - bh - bl + p.carry * (rh - rl - (bh - bl))) * half;
}

export function carryFloorAt(ctx: Ctx, r: number, p: CarryFloor): number {
	const half = ctx.rec.mean[r] / 2 || 1;
	const red = ctx.pred(0, r, 0);
	const blue = ctx.pred(0, r, 1);
	const m = allianceMargin(
		[ctx.f(r, 'redHi'), ctx.f(r, 'blueHi')],
		[ctx.f(r, 'redLo'), ctx.f(r, 'blueLo')],
		half,
		p
	);
	const lvl = ctx.rec.mean[r] > 0 ? Math.min(Math.max((red + blue) / (2 * ctx.rec.mean[r]), 0.25), 4) : 1;
	const s = p.kappa * ctx.rec.sd[r] * Math.sqrt(ctx.pred(0, r, 2) + p.eta * ctx.rec.unc[r]) * lvl ** p.gamma;
	return sigmoid(m / s);
}

export function carryFloor(ctx: Ctx, p: CarryFloor): Float64Array {
	const out = new Float64Array(ctx.rec.n);
	for (let r = 0; r < ctx.rec.n; r++) out[r] = carryFloorAt(ctx, r, p);
	return out;
}
