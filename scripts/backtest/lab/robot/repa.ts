import type { Ctx, Model, Pred } from '../../models.ts';
import type { PEvent, PMatch } from '../../prep.ts';
import type { RMatch, Side } from './data.ts';
import { Tracker } from './track.ts';

export type EpaComp = {
	k0: number;
	kMin: number;
	tau: number;
	reset: number;
	wk: number;
	carry: number;
	drift: number;
	beta: number;
	rhoNew: number;
	rhoPrev: number;
	rhoNewScore: number;
	rhoPrevScore: number;
};

export type RepaOpts = {
	rest: EpaComp;
	robot?: EpaComp;
	auto?: EpaComp;
	move?: EpaComp;
	gate?: number;
	margin?: number;
	clip?: number;
	unc?: number;
	het?: number;
	hist?: number[];
};

type St = { r: number; s: number; n: number; meanRef: number; event: string; day: number };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

class Rating {
	p: EpaComp;
	teams = new Map<number, St>();
	prevRel = new Map<number, number>();
	code = '';

	constructor(p: EpaComp) {
		this.p = p;
	}

	startSeason(prevRel: Map<number, number>): void {
		this.teams = new Map();
		this.prevRel = prevRel;
	}

	get(team: number, mean: number, day: number): St {
		const p = this.p;
		let s = this.teams.get(team);
		if (!s) {
			const prev = this.prevRel.get(team);
			const b = prev === undefined ? 0 : p.beta * (prev - 1);
			const rel = prev === undefined ? p.rhoNew : p.rhoPrev + b;
			const relS = prev === undefined ? p.rhoNewScore : p.rhoPrevScore + b;
			s = { r: (mean / 2) * rel, s: (mean / 2) * relS, n: 0, meanRef: mean, event: this.code, day };
			this.teams.set(team, s);
			return s;
		}
		if (s.event !== this.code) {
			const carried = (x: number) => {
				const rel = s!.meanRef > 0 ? x / (s!.meanRef / 2) : 1;
				const scale = s!.meanRef > 0 && mean > 0 ? (mean / s!.meanRef) ** p.drift : 1;
				return (1 + p.carry * (rel - 1)) * (s!.meanRef / 2) * scale;
			};
			s.r = carried(s.r);
			s.s = carried(s.s);
			const weeks = Math.max(0, day - s.day) / 7;
			s.n = s.n * p.reset * Math.exp(-p.wk * weeks);
			s.meanRef = mean;
			s.event = this.code;
		}
		return s;
	}

	k(n: number): number {
		const p = this.p;
		return p.kMin + (p.k0 - p.kMin) * Math.exp(-n / p.tau);
	}

	endSeason(): Map<number, number> {
		return new Map(
			[...this.teams]
				.filter(([, s]) => s.n > 0)
				.map(([t, s]) => [t, s.meanRef > 0 ? s.r / (s.meanRef / 2) : 1])
		);
	}
}

export class RobotEpa implements Model {
	name: string;
	o: RepaOpts;
	rest: Rating;
	robot: Rating | null;
	auto: Rating | null;
	move: Rating | null;
	all: Rating[];
	track = new Tracker(['np', 'robot', 'anr', 'mv'], { np: 100, robot: 20, anr: 10, mv: 1.2 });
	past: Map<number, number>[][] = [];
	day = 0;

	constructor(name: string, o: RepaOpts) {
		this.name = name;
		this.o = o;
		this.rest = new Rating(o.rest);
		this.robot = o.robot ? new Rating(o.robot) : null;
		this.auto = o.auto ? new Rating(o.auto) : null;
		this.move = o.move ? new Rating(o.move) : null;
		this.all = [this.rest, this.robot, this.auto, this.move].filter((c): c is Rating => c !== null);
	}

	blendRel(k: number): Map<number, number> {
		const w = [1, ...(this.o.hist ?? [])];
		const out = new Map<number, number>();
		const totals = new Map<number, number>();
		for (let j = 0; j < w.length && j < this.past.length; j++) {
			if (w[j] <= 0) continue;
			for (const [t, r] of this.past[this.past.length - 1 - j][k]) {
				out.set(t, (out.get(t) ?? 0) + w[j] * r);
				totals.set(t, (totals.get(t) ?? 0) + w[j]);
			}
		}
		for (const [t, s] of totals) out.set(t, out.get(t)! / s);
		return out;
	}

	startSeason(): void {
		this.track.startSeason();
		this.all.forEach((c, k) => c.startSeason(this.blendRel(k)));
	}

	means(ctx: Ctx): number[] {
		const t = this.track;
		const np = Math.max(t.mean('np'), 1e-6);
		const f = (k: string) => (ctx.mean * t.mean(k)) / np;
		const out = [ctx.mean - (this.robot ? f('robot') : 0) - (this.auto ? f('anr') : 0)];
		if (this.robot) out.push(f('robot'));
		if (this.auto) out.push(f('anr'));
		if (this.move) out.push(t.mean('mv'));
		return out;
	}

	startEvent(event: PEvent, ctx: Ctx): void {
		this.track.startEvent(ctx.day);
		this.day = ctx.day;
		for (const c of this.all) c.code = event.code;
	}

	states(team: number, ctx: Ctx): St[] {
		const means = this.means(ctx);
		return this.all.map((c, k) => c.get(team, means[k], ctx.day));
	}

	gateOf(team: number, ctx: Ctx): number {
		const g = this.o.gate ?? 1;
		if (g >= 1 || !this.move) return 1;
		const st = this.states(team, ctx);
		const p = Math.min(Math.max(st[st.length - 1].r, 0), 1);
		return g + (1 - g) * p;
	}

	value(team: number, ctx: Ctx, score: boolean): number {
		const st = this.states(team, ctx);
		const v = (x: St) => (score ? x.s : x.r);
		let out = v(st[0]);
		let k = 1;
		if (this.robot) out += v(st[k++]);
		if (this.auto) out += this.gateOf(team, ctx) * v(st[k]);
		return out;
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		const side = (ts: number[], score: boolean) =>
			ts.reduce((a, t) => a + this.value(t, ctx, score), 0);
		let varFactor = 1;
		if (this.o.unc) {
			for (const t of [...m.red, ...m.blue])
				varFactor += this.o.unc / (1 + this.states(t, ctx)[0].n);
		}
		return {
			red: side(m.red, false),
			blue: side(m.blue, false),
			varFactor,
			redScore: side(m.red, true),
			blueScore: side(m.blue, true)
		};
	}

	update(m: PMatch, ctx: Ctx): void {
		const r = m as RMatch;
		const lim = (this.o.clip ?? 4) * ctx.sd;
		const clip = (x: number) => (x > lim ? lim : x < -lim ? -lim : x);
		const M = this.o.margin ?? 0;
		const g = this.o.gate ?? 1;
		type Work = {
			ts: number[];
			pos: number[];
			ok: boolean;
			err: number;
			errS: number;
			f: number;
			sd: Side | null | undefined;
		};
		const restMean = this.means(ctx)[0];
		const het = this.o.het ?? 0;
		const prep = (
			all: number[],
			upd: number[],
			y: number,
			ok: boolean,
			sd: Side | null | undefined
		): Work => {
			const pos = upd.map((t) => all.indexOf(t));
			let target = y;
			if (sd) {
				if (this.robot) target -= sum(sd.ra) + sum(sd.re);
				if (this.auto) target -= sd.auto - (this.robot ? sum(sd.ra) : 0);
			}
			let pred = 0;
			let predS = 0;
			let level = 0;
			for (const t of upd) {
				const st = this.states(t, ctx);
				pred += st[0].r;
				predS += st[0].s;
				level += st[0].r;
				if (!sd) {
					let k = 1;
					if (this.robot) {
						pred += st[k].r;
						predS += st[k].s;
						k++;
					}
					if (this.auto) {
						pred += this.gateOf(t, ctx) * st[k].r;
						predS += this.gateOf(t, ctx) * st[k].s;
					}
				}
			}
			const f =
				het !== 0 && restMean > 0 ? Math.min(Math.max(level / restMean, 0.25), 4) ** -het : 1;
			return { ts: upd, pos, ok, err: clip(target - pred), errS: clip(target - predS), f, sd };
		};
		const red = prep(m.red, m.redUpd, m.redNp, m.redOk, r.red2);
		const blue = prep(m.blue, m.blueUpd, m.blueNp, m.blueOk, r.blue2);
		const apply = (w: Work, opp: Work) => {
			if (!w.ok || !w.ts.length) return;
			const d = (w.f * (w.err - M * (opp.ok ? opp.err : 0))) / (1 + M) / w.ts.length;
			const dS = (w.errS - M * (opp.ok ? opp.errS : 0)) / (1 + M) / w.ts.length;
			const sd = w.sd;
			const hs = sd ? w.pos.map((p) => (sd.mv[p] ? 1 : g)) : [];
			const hsum = sum(hs);
			let autoErr = 0;
			let autoErrS = 0;
			if (sd && this.auto) {
				const anr = sd.auto - (this.robot ? sum(sd.ra) : 0);
				let pa = 0;
				let paS = 0;
				w.ts.forEach((t, j) => {
					const st = this.states(t, ctx);
					pa += hs[j] * st[st.length - (this.move ? 2 : 1)].r;
					paS += hs[j] * st[st.length - (this.move ? 2 : 1)].s;
				});
				autoErr = clip(anr - pa);
				autoErrS = clip(anr - paS);
			}
			w.ts.forEach((t, j) => {
				const st = this.states(t, ctx);
				const k0 = this.rest.k(st[0].n);
				st[0].r += k0 * d;
				st[0].s += k0 * dS;
				if (!sd) return;
				const p = w.pos[j];
				let k = 1;
				if (this.robot) {
					const y = sd.ra[p] + sd.re[p];
					const kr = this.robot.k(st[k].n);
					st[k].r += kr * (y - st[k].r);
					st[k].s += kr * (y - st[k].s);
					k++;
				}
				if (this.auto) {
					const ka = this.auto.k(st[k].n);
					const share = hsum > 0 ? hs[j] / hsum : 1 / w.ts.length;
					st[k].r += ka * autoErr * share;
					st[k].s += ka * autoErrS * share;
					k++;
				}
				if (this.move) {
					const km = this.move.k(st[k].n);
					st[k].r += km * (sd.mv[p] - st[k].r);
					st[k].s = st[k].r;
				}
			});
		};
		apply(red, blue);
		apply(blue, red);
		for (const t of [...m.redUpd, ...m.blueUpd]) {
			const means = this.means(ctx);
			this.all.forEach((c, k) => {
				const s = c.get(t, means[k], ctx.day);
				s.n++;
				s.meanRef = means[k];
				s.day = ctx.day;
			});
		}
		for (const [ok, y, sd] of [
			[m.redOk, m.redNp, r.red2],
			[m.blueOk, m.blueNp, r.blue2]
		] as const) {
			if (!ok || !sd) continue;
			const ra = sum(sd.ra);
			this.track.add({
				np: y,
				robot: ra + sum(sd.re),
				anr: sd.auto - (this.robot ? ra : 0),
				mv: sum(sd.mv)
			});
		}
	}

	endEvent(): void {
		this.track.endEvent();
	}

	endSeason(): Map<number, number> {
		this.past.push(this.all.map((c) => c.endSeason()));
		return this.past[this.past.length - 1][0];
	}
}
