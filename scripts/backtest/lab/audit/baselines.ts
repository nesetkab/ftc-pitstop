import type { Ctx, KalmanOpr, Model, Pred } from '../../models.ts';
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

type Row = { teams: number[]; y: number };

export class SeasonOpr implements Model {
	name: string;
	seasons: Set<number>;
	playoffs: boolean;
	active = false;
	x = new Map<number, number>();
	parent = new Map<number, number>();
	members = new Map<number, number[]>();
	rows = new Map<number, Row[]>();
	dirty = new Set<number>();
	iterations = 0;

	constructor(name: string, seasons: number[], opts: { playoffs?: boolean } = {}) {
		this.name = name;
		this.seasons = new Set(seasons);
		this.playoffs = opts.playoffs ?? false;
	}

	startSeason(): void {
		this.x = new Map();
		this.parent = new Map();
		this.members = new Map();
		this.rows = new Map();
		this.dirty = new Set();
	}

	startEvent(event: PEvent): void {
		this.active = this.seasons.has(event.season);
	}

	find(t: number): number {
		let r = t;
		while (this.parent.get(r) !== r) r = this.parent.get(r)!;
		let c = t;
		while (c !== r) {
			const n = this.parent.get(c)!;
			this.parent.set(c, r);
			c = n;
		}
		return r;
	}

	ensure(t: number): void {
		if (this.parent.has(t)) return;
		this.parent.set(t, t);
		this.members.set(t, [t]);
		this.rows.set(t, []);
		this.x.set(t, 0);
	}

	union(a: number, b: number): number {
		let ra = this.find(a);
		let rb = this.find(b);
		if (ra === rb) return ra;
		if (this.members.get(ra)!.length < this.members.get(rb)!.length) [ra, rb] = [rb, ra];
		this.parent.set(rb, ra);
		const into = this.members.get(ra)!;
		for (const t of this.members.get(rb)!) into.push(t);
		const rowsInto = this.rows.get(ra)!;
		for (const row of this.rows.get(rb)!) rowsInto.push(row);
		this.members.delete(rb);
		this.rows.delete(rb);
		this.dirty.delete(rb);
		return ra;
	}

	add(teams: number[], y: number): void {
		if (!teams.length) return;
		for (const t of teams) this.ensure(t);
		let root = this.find(teams[0]);
		for (const t of teams.slice(1)) root = this.union(root, t);
		this.rows.get(root)!.push({ teams, y });
		this.dirty.add(root);
	}

	solve(root: number): void {
		const teams = this.members.get(root)!;
		const rows = this.rows.get(root)!;
		const idx = new Map(teams.map((t, i) => [t, i]));
		const n = teams.length;
		const m = rows.length;
		const cols = rows.map((r) => r.teams.map((t) => idx.get(t)!));
		const x = Float64Array.from(teams, (t) => this.x.get(t)!);
		const r = new Float64Array(m);
		for (let i = 0; i < m; i++) {
			let s = 0;
			for (const j of cols[i]) s += x[j];
			r[i] = rows[i].y - s;
		}
		const atr = (v: Float64Array) => {
			const out = new Float64Array(n);
			for (let i = 0; i < m; i++) for (const j of cols[i]) out[j] += v[i];
			return out;
		};
		let s = atr(r);
		const p = Float64Array.from(s);
		let gamma = s.reduce((a, v) => a + v * v, 0);
		const norm = rows.reduce((a, row) => a + row.y * row.y, 0);
		const q = new Float64Array(m);
		for (let it = 0; it < 4 * n + 50 && gamma > 1e-20 * Math.max(norm, 1); it++) {
			this.iterations++;
			let qq = 0;
			for (let i = 0; i < m; i++) {
				let v = 0;
				for (const j of cols[i]) v += p[j];
				q[i] = v;
				qq += v * v;
			}
			if (qq === 0) break;
			const alpha = gamma / qq;
			for (let j = 0; j < n; j++) x[j] += alpha * p[j];
			for (let i = 0; i < m; i++) r[i] -= alpha * q[i];
			s = atr(r);
			const g = s.reduce((a, v) => a + v * v, 0);
			const beta = g / gamma;
			gamma = g;
			for (let j = 0; j < n; j++) p[j] = s[j] + beta * p[j];
		}
		teams.forEach((t, i) => this.x.set(t, x[i]));
		this.dirty.delete(root);
	}

	team(t: number, ctx: Ctx): number {
		if (!this.parent.has(t)) return ctx.mean / 2;
		const root = this.find(t);
		if (this.dirty.has(root)) this.solve(root);
		return this.x.get(t)!;
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		if (!this.active) return { red: ctx.mean, blue: ctx.mean, varFactor: 1, redScore: ctx.mean, blueScore: ctx.mean };
		const red = m.red.reduce((a, t) => a + this.team(t, ctx), 0);
		const blue = m.blue.reduce((a, t) => a + this.team(t, ctx), 0);
		return { red, blue, varFactor: 1, redScore: red, blueScore: blue };
	}

	update(m: PMatch): void {
		if (!this.active || (m.playoff && !this.playoffs)) return;
		this.add(m.red, m.redNp);
		this.add(m.blue, m.blueNp);
	}

	endEvent(): void {}

	endSeason(): Map<number, number> {
		return new Map();
	}
}

export class PriorFallbackOpr implements Model {
	name: string;
	live: LiveOpr;
	prior: KalmanOpr;
	score: boolean;

	constructor(name: string, prior: KalmanOpr, score: boolean) {
		this.name = name;
		this.live = new LiveOpr(`${name} live`, 'mean');
		this.prior = prior;
		this.score = score;
	}

	startSeason(prevRel: Map<number, number>): void {
		this.live.startSeason();
		this.prior.startSeason(prevRel);
	}

	startEvent(event: PEvent, ctx: Ctx): void {
		this.live.startEvent(event);
		this.prior.startEvent(event, ctx);
	}

	team(t: number, ctx: Ctx): number {
		return this.live.value.get(t) ?? this.prior.value(t, ctx, this.score);
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		this.prior.predict(m, ctx);
		if (this.live.dirty) this.live.solve();
		const red = m.red.reduce((a, t) => a + this.team(t, ctx), 0);
		const blue = m.blue.reduce((a, t) => a + this.team(t, ctx), 0);
		return { red, blue, varFactor: 1, redScore: red, blueScore: blue };
	}

	update(m: PMatch, ctx: Ctx): void {
		this.live.update(m);
		this.prior.update(m, ctx);
	}

	endEvent(event: PEvent, ctx: Ctx): void {
		this.live.endEvent();
		this.prior.endEvent(event, ctx);
	}

	endSeason(): Map<number, number> {
		return this.prior.endSeason();
	}
}
