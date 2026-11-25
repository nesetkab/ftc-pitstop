import { KalmanOpr, type Ctx, type Model, type OprParams, type Pred } from '../../models.ts';
import type { PEvent, PMatch } from '../../prep.ts';

export class TotalOpr extends KalmanOpr {
	constructor(name: string, p: OprParams) {
		super(name, p);
	}

	update(m: PMatch, ctx: Ctx): void {
		super.update({ ...m, redNp: m.redTotal, blueNp: m.blueTotal }, ctx);
	}
}

type EloState = { r: number; meanRef: number };

export class OutcomeElo implements Model {
	name: string;
	k: number;
	width: number;
	carry: number;
	teams = new Map<number, EloState>();
	prevRel = new Map<number, number>();

	constructor(name: string, k: number, width: number, carry: number) {
		this.name = name;
		this.k = k;
		this.width = width;
		this.carry = carry;
	}

	startSeason(prevRel: Map<number, number>): void {
		this.teams = new Map();
		this.prevRel = prevRel;
	}

	startEvent(_event: PEvent, ctx: Ctx): void {
		for (const s of this.teams.values()) {
			const rel = s.meanRef > 0 ? s.r / (s.meanRef / 2) : 1;
			s.r = (1 + this.carry * (rel - 1)) * (ctx.mean / 2);
			s.meanRef = ctx.mean;
		}
	}

	ensure(t: number, ctx: Ctx): EloState {
		let s = this.teams.get(t);
		if (!s) {
			const prev = this.prevRel.get(t);
			const rel = prev === undefined ? 0.3 : 0.45 + 0.5 * (prev - 1);
			s = { r: (ctx.mean / 2) * rel, meanRef: ctx.mean };
			this.teams.set(t, s);
		}
		return s;
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		const red = m.red.reduce((a, t) => a + this.ensure(t, ctx).r, 0);
		const blue = m.blue.reduce((a, t) => a + this.ensure(t, ctx).r, 0);
		return { red, blue, varFactor: 1, redScore: red, blueScore: blue };
	}

	update(m: PMatch, ctx: Ctx): void {
		const sd = ctx.sd > 0 ? ctx.sd : 1;
		const red = m.redUpd.reduce((a, t) => a + this.ensure(t, ctx).r, 0);
		const blue = m.blueUpd.reduce((a, t) => a + this.ensure(t, ctx).r, 0);
		const p = 1 / (1 + Math.exp(-(red - blue) / (this.width * sd)));
		const y = m.redTotal > m.blueTotal ? 1 : m.redTotal < m.blueTotal ? 0 : 0.5;
		const step = this.k * sd * (y - p);
		for (const t of m.redUpd) this.teams.get(t)!.r += step / m.redUpd.length;
		for (const t of m.blueUpd) this.teams.get(t)!.r -= step / m.blueUpd.length;
	}

	endEvent(): void {}

	endSeason(): Map<number, number> {
		return new Map([...this.teams].map(([t, s]) => [t, s.meanRef > 0 ? s.r / (s.meanRef / 2) : 1]));
	}
}
