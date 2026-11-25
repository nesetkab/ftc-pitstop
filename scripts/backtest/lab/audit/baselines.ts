import type { Ctx, Model, Pred } from '../../models.ts';
import type { PEvent, PMatch } from '../../prep.ts';

export type OprFallback = 'mean' | 'last' | 'best' | 'avg' | 'zero';

const RIDGE = 1e-6;

export function minNormSolve(ata: Float64Array, atb: Float64Array, k: number): Float64Array {
	const L = new Float64Array(k * k);
	for (let i = 0; i < k; i++) {
		for (let j = 0; j <= i; j++) {
			let s = ata[i * k + j] + (i === j ? RIDGE : 0);
			for (let p = 0; p < j; p++) s -= L[i * k + p] * L[j * k + p];
			L[i * k + j] = i === j ? Math.sqrt(Math.max(s, 1e-300)) : s / L[j * k + j];
		}
	}
	const y = new Float64Array(k);
	for (let i = 0; i < k; i++) {
		let s = atb[i];
		for (let p = 0; p < i; p++) s -= L[i * k + p] * y[p];
		y[i] = s / L[i * k + i];
	}
	const x = new Float64Array(k);
	for (let i = k - 1; i >= 0; i--) {
		let s = y[i];
		for (let p = i + 1; p < k; p++) s -= L[p * k + i] * x[p];
		x[i] = s / L[i * k + i];
	}
	return x;
}

export class LiveOpr implements Model {
	name: string;
	fallback: OprFallback;
	total: boolean;
	playoffs: boolean;
	last = new Map<number, number>();
	best = new Map<number, number>();
	sum = new Map<number, { s: number; n: number }>();
	order: number[] = [];
	slot = new Map<number, number>();
	cap = 0;
	ata = new Float64Array(0);
	atb = new Float64Array(0);
	value = new Map<number, number>();
	dirty = false;

	constructor(name: string, fallback: OprFallback, opts: { total?: boolean; playoffs?: boolean } = {}) {
		this.name = name;
		this.fallback = fallback;
		this.total = opts.total ?? false;
		this.playoffs = opts.playoffs ?? false;
	}

	startSeason(): void {
		this.last = new Map();
		this.best = new Map();
		this.sum = new Map();
	}

	startEvent(event: PEvent): void {
		const teams = new Set<number>();
		for (const m of event.matches) for (const t of [...m.red, ...m.blue]) teams.add(t);
		this.cap = teams.size;
		this.order = [];
		this.slot = new Map();
		this.ata = new Float64Array(this.cap * this.cap);
		this.atb = new Float64Array(this.cap);
		this.value = new Map();
		this.dirty = false;
	}

	index(team: number): number {
		let i = this.slot.get(team);
		if (i === undefined) {
			i = this.order.length;
			this.order.push(team);
			this.slot.set(team, i);
		}
		return i;
	}

	solve(): void {
		const k = this.order.length;
		const ata = new Float64Array(k * k);
		for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) ata[a * k + b] = this.ata[a * this.cap + b];
		const x = minNormSolve(ata, this.atb.subarray(0, k), k);
		this.value = new Map(this.order.map((t, i) => [t, x[i]]));
		this.dirty = false;
	}

	fallbackFor(team: number, ctx: Ctx): number {
		const half = ctx.mean / 2;
		if (this.fallback === 'zero') return 0;
		if (this.fallback === 'last') return this.last.get(team) ?? half;
		if (this.fallback === 'best') return this.best.get(team) ?? half;
		if (this.fallback === 'avg') {
			const s = this.sum.get(team);
			return s ? s.s / s.n : half;
		}
		return half;
	}

	team(t: number, ctx: Ctx): number {
		return this.value.get(t) ?? this.fallbackFor(t, ctx);
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		if (this.dirty) this.solve();
		const red = m.red.reduce((a, t) => a + this.team(t, ctx), 0);
		const blue = m.blue.reduce((a, t) => a + this.team(t, ctx), 0);
		return { red, blue, varFactor: 1, redScore: red, blueScore: blue };
	}

	add(teams: number[], y: number): void {
		const idx = teams.map((t) => this.index(t));
		for (const a of idx) {
			this.atb[a] += y;
			for (const b of idx) this.ata[a * this.cap + b] += 1;
		}
		this.dirty = true;
	}

	update(m: PMatch): void {
		if (m.playoff && !this.playoffs) return;
		this.add(m.red, this.total ? m.redTotal : m.redNp);
		this.add(m.blue, this.total ? m.blueTotal : m.blueNp);
	}

	endEvent(): void {
		if (this.dirty) this.solve();
		for (const [t, v] of this.value) {
			this.last.set(t, v);
			this.best.set(t, Math.max(this.best.get(t) ?? -Infinity, v));
			const s = this.sum.get(t) ?? { s: 0, n: 0 };
			s.s += v;
			s.n++;
			this.sum.set(t, s);
		}
	}

	endSeason(): Map<number, number> {
		return new Map();
	}
}

export class AvgScore implements Model {
	name: string;
	scope: 'season' | 'event';
	season = new Map<number, { s: number; n: number }>();
	event = new Map<number, { s: number; n: number }>();

	constructor(name: string, scope: 'season' | 'event') {
		this.name = name;
		this.scope = scope;
	}

	startSeason(): void {
		this.season = new Map();
	}

	startEvent(): void {
		this.event = new Map();
	}

	team(t: number, ctx: Ctx): number {
		const s = (this.scope === 'season' ? this.season : this.event).get(t);
		return s ? s.s / s.n : ctx.mean;
	}

	alliance(teams: number[], ctx: Ctx): number {
		return teams.reduce((a, t) => a + this.team(t, ctx), 0) / Math.max(teams.length, 1);
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		const red = this.alliance(m.red, ctx);
		const blue = this.alliance(m.blue, ctx);
		return { red, blue, varFactor: 1, redScore: red, blueScore: blue };
	}

	update(m: PMatch): void {
		for (const map of [this.season, this.event]) {
			for (const [teams, y] of [
				[m.redUpd, m.redNp],
				[m.blueUpd, m.blueNp]
			] as const) {
				for (const t of teams) {
					const s = map.get(t) ?? { s: 0, n: 0 };
					s.s += y;
					s.n++;
					map.set(t, s);
				}
			}
		}
	}

	endEvent(_e: PEvent): void {}

	endSeason(): Map<number, number> {
		return new Map();
	}
}

export class Elo implements Model {
	name: string;
	k: number;
	carry: number;
	ratings = new Map<number, number>();

	constructor(name: string, k: number, carry: number) {
		this.name = name;
		this.k = k;
		this.carry = carry;
	}

	startSeason(): void {
		for (const [t, r] of this.ratings) this.ratings.set(t, 1500 + this.carry * (r - 1500));
	}

	startEvent(): void {}

	rating(teams: number[]): number {
		return teams.reduce((a, t) => a + (this.ratings.get(t) ?? 1500), 0);
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		const d = this.rating(m.red) - this.rating(m.blue);
		const half = (d * ctx.sd) / 800;
		return {
			red: ctx.mean + half,
			blue: ctx.mean - half,
			varFactor: 1,
			redScore: ctx.mean / 2,
			blueScore: ctx.mean / 2
		};
	}

	update(m: PMatch): void {
		const d = this.rating(m.red) - this.rating(m.blue);
		const expected = 1 / (1 + 10 ** (-d / 400));
		const s = m.redTotal > m.blueTotal ? 1 : m.redTotal < m.blueTotal ? 0 : 0.5;
		const delta = this.k * (s - expected);
		for (const t of m.red) this.ratings.set(t, (this.ratings.get(t) ?? 1500) + delta);
		for (const t of m.blue) this.ratings.set(t, (this.ratings.get(t) ?? 1500) - delta);
	}

	endEvent(): void {}

	endSeason(): Map<number, number> {
		return new Map();
	}
}
