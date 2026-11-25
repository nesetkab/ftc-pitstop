import type { Ctx, Model, Pred } from '../../models.ts';
import type { PEvent, PMatch } from '../../prep.ts';
import { Comp, type CompParams } from './comp.ts';
import type { RMatch, Side } from './data.ts';
import { Tracker } from './track.ts';

export type RoprOpts = {
	rest: CompParams;
	robot?: CompParams;
	robotSplit?: CompParams;
	auto?: CompParams;
	move?: CompParams;
	gate?: number;
	rVar?: number;
	aVar?: number;
	robotNoise?: number;
	het?: number;
	qLeague?: number;
	xc?: number;
	huber?: number;
	dead?: number;
	moveNoise?: number;
	hist?: number[];
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function eventTeams(event: PEvent): number[] {
	const set = new Set<number>();
	for (const m of event.matches) for (const t of [...m.red, ...m.blue]) set.add(t);
	return [...set];
}

export class RobotOpr implements Model {
	name: string;
	o: RoprOpts;
	rest: Comp;
	robot: Comp | null;
	robotEnd: Comp | null;
	auto: Comp | null;
	move: Comp | null;
	comps: Comp[];
	track = new Tracker(['np', 'robot', 'ra', 're', 'anr', 'mv'], {
		np: 100,
		robot: 20,
		ra: 10,
		re: 10,
		anr: 10,
		mv: 1.2
	});
	past: Map<number, number>[][] = [];
	day = 0;
	restMean = 0;
	sd = 1;

	constructor(name: string, o: RoprOpts) {
		this.name = name;
		this.o = o;
		this.rest = new Comp(o.rest);
		this.robot = o.robot ? new Comp(o.robot, true) : null;
		this.robotEnd = o.robotSplit ? new Comp(o.robotSplit, true) : null;
		this.auto = o.auto ? new Comp(o.auto) : null;
		this.move = o.move ? new Comp(o.move, true) : null;
		this.comps = [this.rest, this.robot, this.robotEnd, this.auto, this.move].filter(
			(c): c is Comp => c !== null
		);
	}

	blendRel(k: number): Map<number, number> {
		const w = [1, ...(this.o.hist ?? [])];
		const out = new Map<number, number>();
		const totals = new Map<number, number>();
		for (let j = 0; j < w.length && j < this.past.length; j++) {
			if (w[j] <= 0) continue;
			const rel = this.past[this.past.length - 1 - j][k];
			for (const [t, r] of rel) {
				out.set(t, (out.get(t) ?? 0) + w[j] * r);
				totals.set(t, (totals.get(t) ?? 0) + w[j]);
			}
		}
		for (const [t, s] of totals) out.set(t, out.get(t)! / s);
		return out;
	}

	startSeason(): void {
		this.track.startSeason();
		this.comps.forEach((c, k) => c.startSeason(this.blendRel(k)));
	}

	means(ctx: Ctx): number[] {
		const t = this.track;
		const np = Math.max(t.mean('np'), 1e-6);
		const f = (k: string) => (ctx.mean * t.mean(k)) / np;
		const robotAll = this.robotEnd ? f('ra') : f('robot');
		const out = [ctx.mean - (this.robot ? f('robot') : 0) - (this.auto ? f('anr') : 0)];
		if (this.robot) out.push(robotAll);
		if (this.robotEnd) out.push(f('re'));
		if (this.auto) out.push(f('anr'));
		if (this.move) out.push(t.mean('mv'));
		return out;
	}

	startEvent(event: PEvent, ctx: Ctx): void {
		this.track.startEvent(ctx.day);
		const teams = eventTeams(event);
		const means = this.means(ctx);
		const qMul = event.type === 'LeagueMeet' ? (this.o.qLeague ?? 1) : 1;
		this.comps.forEach((c, k) => {
			c.qMul = qMul;
			c.startEvent(teams, means[k], ctx.day);
		});
	}

	gateOf(team: number): number {
		const g = this.o.gate ?? 1;
		if (g >= 1 || !this.move) return 1;
		const p = Math.min(Math.max(this.move.mu[this.move.at(team)], 0), 1);
		return g + (1 - g) * p;
	}

	side(teams: number[], score: boolean): number {
		let x = 0;
		for (const t of teams) {
			for (const c of [this.rest, this.robot, this.robotEnd]) {
				if (!c) continue;
				const i = c.at(t);
				x += score ? c.nu[i] : c.mu[i];
			}
			if (this.auto) {
				const i = this.auto.at(t);
				x += this.gateOf(t) * (score ? this.auto.nu[i] : this.auto.mu[i]);
			}
		}
		return x;
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		const means = this.means(ctx);
		for (const t of [...m.red, ...m.blue])
			this.comps.forEach((c, k) => c.refresh(t, means[k], ctx.day));
		const teams = [...m.red, ...m.blue];
		const sign = [...m.red.map(() => 1), ...m.blue.map(() => -1)];
		const idx = teams.map((t) => this.rest.at(t));
		let v = this.rest.variance(idx, sign) + this.rest.p.qMatch * idx.length;
		if (this.robot && this.o.rVar) v += this.o.rVar * this.robot.variance(idx, sign);
		if (this.robotEnd && this.o.rVar) v += this.o.rVar * this.robotEnd.variance(idx, sign);
		if (this.auto && this.o.aVar)
			v +=
				this.o.aVar *
				this.auto.variance(
					idx,
					teams.map((t, k) => sign[k] * this.gateOf(t))
				);
		return {
			red: this.side(m.red, false),
			blue: this.side(m.blue, false),
			varFactor: (v + 2) / 2,
			redScore: this.side(m.red, true),
			blueScore: this.side(m.blue, true)
		};
	}

	observeSide(all: number[], upd: number[], y: number, sd: Side | null | undefined): void {
		const pos = upd.map((t) => all.indexOf(t));
		const idx = upd.map((t) => this.rest.at(t));
		const ones = upd.map(() => 1);
		const rn = this.o.robotNoise ?? 1;
		let rest = y;
		if (sd) {
			if (this.robot) {
				for (let k = 0; k < upd.length; k++) {
					const p = pos[k];
					const yr = this.robotEnd ? sd.ra[p] : sd.ra[p] + sd.re[p];
					const xc = this.o.xc ?? 0;
					if (xc !== 0) {
						const i = idx[k];
						const pii = this.robot.P[i * this.robot.n + i];
						const g = (xc * pii) / (pii + rn);
						this.rest.mu[i] += g * (yr - this.robot.mu[i]);
						this.rest.nu[i] += g * (yr - this.robot.nu[i]);
					}
					this.robot.observe([idx[k]], [1], yr, rn);
					if (this.robotEnd) this.robotEnd.observe([idx[k]], [1], sd.re[p], rn);
				}
				rest -= sum(sd.ra) + sum(sd.re);
			}
			if (this.move) {
				for (let k = 0; k < upd.length; k++)
					this.move.observe([idx[k]], [1], sd.mv[pos[k]], this.o.moveNoise ?? 1);
			}
			if (this.auto) {
				const anr = sd.auto - (this.robot ? sum(sd.ra) : 0);
				const g = this.o.gate ?? 1;
				this.auto.observe(
					idx,
					pos.map((p) => (sd.mv[p] ? 1 : g)),
					anr
				);
				rest -= anr;
			}
		} else {
			for (const c of [this.robot, this.robotEnd]) {
				if (!c) continue;
				for (const i of idx) rest -= c.mu[i];
			}
			if (this.auto) for (const t of upd) rest -= this.gateOf(t) * this.auto.mu[this.auto.at(t)];
		}
		let r = 1;
		const het = this.o.het ?? 0;
		if (het !== 0 && this.restMean > 0) {
			const pred = idx.reduce((a, i) => a + this.rest.mu[i], 0);
			r = Math.min(Math.max(pred / this.restMean, 0.25), 4) ** het;
		}
		const huber = this.o.huber ?? 0;
		if (huber > 0) {
			const v = this.rest.variance(idx, ones);
			const pred = idx.reduce((a, i) => a + this.rest.mu[i], 0);
			const z = Math.abs(rest - pred) / (0.8 * this.sd * Math.sqrt(v + r));
			if (z > huber) r = (v + r) * (z / huber) - v;
		}
		const dead = this.o.dead ?? 1;
		const h = sd && dead < 1 ? pos.map((p) => (sd.mv[p] || sd.re[p] > 0 ? 1 : dead)) : ones;
		this.rest.observe(idx, h, rest, r);
	}

	update(m: PMatch, ctx: Ctx): void {
		const r = m as RMatch;
		this.restMean = this.means(ctx)[0];
		this.sd = ctx.sd;
		const upd = [...m.redUpd, ...m.blueUpd];
		const idx = upd.map((t) => this.rest.at(t));
		for (const c of this.comps) c.bump(idx, c.p.qMatch);
		if (m.redOk) this.observeSide(m.red, m.redUpd, m.redNp, r.red2);
		if (m.blueOk) this.observeSide(m.blue, m.blueUpd, m.blueNp, r.blue2);
		for (const c of this.comps) for (const i of idx) c.played[i]++;
		for (const [ok, y, sd] of [
			[m.redOk, m.redNp, r.red2],
			[m.blueOk, m.blueNp, r.blue2]
		] as const) {
			if (!ok || !sd) continue;
			const ra = sum(sd.ra);
			const re = sum(sd.re);
			this.track.add({
				np: y,
				robot: ra + re,
				ra,
				re,
				anr: sd.auto - (this.robot ? ra : 0),
				mv: sum(sd.mv)
			});
		}
	}

	endEvent(_event: PEvent, ctx: Ctx): void {
		const means = this.means(ctx);
		this.comps.forEach((c, k) => c.endEvent(means[k], ctx.day));
		this.track.endEvent();
	}

	endSeason(): Map<number, number> {
		this.past.push(this.comps.map((c) => c.endSeason()));
		return this.past[this.past.length - 1][0];
	}
}
