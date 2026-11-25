import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Ctx, Model, Pred } from '../../models.ts';
import type { PEvent, PMatch } from '../../prep.ts';
import { softFloor } from '../../../../src/lib/model/opr.ts';
import { ImbRobotOpr } from '../pooled/robotimb.ts';
import type { RoprOpts } from '../robot/ropr.ts';

export const ROBOT_HET = JSON.parse(
	readFileSync(join(import.meta.dirname, '..', 'robot', 'params', 'het.json'), 'utf8')
) as RoprOpts;

export type Gap = 'rest' | 'total' | 'floored';

export type Head = {
	imb: number;
	gap?: Gap;
	floor?: number;
	width?: number;
	floorScore?: boolean;
	imbRobot?: number;
	pooled?: number;
};

type Team = { restMu: number; restNu: number; mu: number; nu: number };
type Snap = { out: Pred; red: Team[]; blue: Team[]; half: number };

export function headPred(s: Snap, h: Head): Pred {
	const f = (v: number) =>
		h.floor === undefined ? v : softFloor(v / s.half, h.floor, h.width ?? 0.16) * s.half;
	const side = (ts: Team[], score: boolean) => {
		const raw = ts.map((t) => (score ? t.nu : t.mu));
		const floored = score && !h.floorScore ? raw : raw.map(f);
		let x = floored.reduce((a, b) => a + b, 0);
		if (h.imb !== 0 && ts.length === 2) {
			const g = h.gap ?? 'rest';
			const v =
				g === 'rest' ? ts.map((t) => (score ? t.restNu : t.restMu)) : g === 'total' ? raw : floored;
			x += h.imb * Math.abs(v[0] - v[1]);
		}
		if (h.imbRobot && ts.length === 2) {
			const r = ts.map((t) => (score ? t.nu - t.restNu : t.mu - t.restMu));
			x += h.imbRobot * Math.abs(r[0] - r[1]);
		}
		return x;
	};
	return {
		red: side(s.red, false),
		blue: side(s.blue, false),
		varFactor: s.out.varFactor,
		redScore: side(s.red, true),
		blueScore: side(s.blue, true)
	};
}

export type FitFloor = { floor: number; width: number };

export class FinalOpr extends ImbRobotOpr {
	head: Head;
	half = 1;

	constructor(name: string, o: RoprOpts, imbFit: number, head: Head, fitFloor?: FitFloor) {
		super(name, o, 0, imbFit);
		this.head = head;
		if (!fitFloor) return;
		const rest = this.rest;
		const observe = rest.observe.bind(rest);
		rest.observe = (idx: number[], h: number[], y: number, r = 1) => {
			let adj = 0;
			const g = idx.map((i, k) => {
				const tot = rest.mu[i] + (this.robot ? this.robot.mu[i] : 0);
				const t = (tot / this.half - fitFloor.floor) / fitFloor.width;
				const slope = 1 / (1 + Math.exp(-t));
				adj += softFloor(tot / this.half, fitFloor.floor, fitFloor.width) * this.half - tot;
				adj += (1 - slope) * rest.mu[i];
				return h[k] * slope;
			});
			observe(idx, g, y - adj, r);
		};
	}

	update(m: PMatch, ctx: Ctx): void {
		this.half = ctx.mean / 2 || 1;
		super.update(m, ctx);
	}

	snap(m: PMatch, ctx: Ctx): Snap {
		const out = super.predict(m, ctx);
		const team = (t: number): Team => {
			const i = this.rest.at(t);
			return {
				restMu: this.rest.mu[i],
				restNu: this.rest.nu[i],
				mu: this.side([t], false),
				nu: this.side([t], true)
			};
		};
		return { out, red: m.red.map(team), blue: m.blue.map(team), half: ctx.mean / 2 || 1 };
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		return headPred(this.snap(m, ctx), this.head);
	}
}

class View implements Model {
	name: string;
	fan: Fan;
	head: Head;
	driver: boolean;

	constructor(name: string, fan: Fan, head: Head, driver: boolean) {
		this.name = name;
		this.fan = fan;
		this.head = head;
		this.driver = driver;
	}

	startSeason(prev: Map<number, number>): void {
		if (this.driver) this.fan.base.startSeason(prev);
	}

	startEvent(event: PEvent, ctx: Ctx): void {
		if (this.driver) this.fan.base.startEvent(event, ctx);
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		if (this.fan.last !== m) {
			this.fan.last = m;
			this.fan.cur = this.fan.base.snap(m, ctx);
		}
		const p = headPred(this.fan.cur!, this.head);
		const w = this.head.pooled;
		const q = this.fan.tap?.last;
		if (!w || !q) return p;
		const mix = (u: number, v: number) => (1 - w) * u + w * v;
		return {
			red: mix(p.red, q.red),
			blue: mix(p.blue, q.blue),
			varFactor: mix(p.varFactor, q.varFactor),
			redScore: mix(p.redScore, q.redScore),
			blueScore: mix(p.blueScore, q.blueScore)
		};
	}

	update(m: PMatch, ctx: Ctx): void {
		if (this.driver) this.fan.base.update(m, ctx);
	}

	endEvent(event: PEvent, ctx: Ctx): void {
		if (this.driver) this.fan.base.endEvent(event, ctx);
	}

	endSeason(): Map<number, number> {
		return this.driver ? this.fan.base.endSeason() : new Map();
	}
}

export class Tap implements Model {
	name: string;
	inner: Model;
	last: Pred | null = null;

	constructor(name: string, inner: Model) {
		this.name = name;
		this.inner = inner;
	}

	startSeason(prev: Map<number, number>): void {
		this.inner.startSeason(prev);
	}

	startEvent(event: PEvent, ctx: Ctx): void {
		this.inner.startEvent(event, ctx);
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		this.last = this.inner.predict(m, ctx);
		return this.last;
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

export class Fan {
	base: FinalOpr;
	tap: Tap | null = null;
	last: PMatch | null = null;
	cur: Snap | null = null;

	constructor(o: RoprOpts, imbFit: number, fitFloor?: FitFloor) {
		this.base = new FinalOpr('base', o, imbFit, { imb: 0 }, fitFloor);
	}

	views(heads: Record<string, Head>): Model[] {
		return Object.entries(heads).map(([name, h], i) => new View(name, this, h, i === 0));
	}
}
