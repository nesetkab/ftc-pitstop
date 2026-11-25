import { SwarmBook } from './rp.ts';
import {
	plausibleMatch,
	rated,
	type AllianceDetail,
	type ModelEvent,
	type ModelMatch
} from './types.ts';

export const COMPONENTS = [
	'auto',
	'teleop',
	'hive',
	'leave',
	'park',
	'garden',
	'flower',
	'tips',
	'fouls'
] as const;

export type Component = (typeof COMPONENTS)[number];

export type Track = 'strength' | 'opr' | Component;

const DETAIL_KEY: Record<Component, keyof AllianceDetail> = {
	auto: 'autoPoints',
	teleop: 'teleopPoints',
	hive: 'hivePoints',
	leave: 'leavePoints',
	park: 'parkPoints',
	garden: 'gardenPoints',
	flower: 'flowerPoints',
	tips: 'tips',
	fouls: 'fouls'
};

const OWN_SCALE = new Set<number>([COMPONENTS.indexOf('tips'), COMPONENTS.indexOf('fouls')]);
const SPLIT = (['auto', 'hive', 'flower', 'garden', 'park'] as const).map((c) =>
	COMPONENTS.indexOf(c)
);
const POINT_PARTS = new Set<number>(
	(['auto', 'teleop', 'hive', 'leave', 'park', 'garden', 'flower'] as const).map((c) =>
		COMPONENTS.indexOf(c)
	)
);

export type CompParams = {
	lamNew: number;
	lamReturning: number;
	rhoNew: number;
	rhoReturning: number;
	rhoNewScore: number;
	rhoReturningScore: number;
	beta: number;
	q: number;
	qWeek: number;
	carry: number;
	drift: number;
};

export type PartParams = {
	rhoNew: number;
	rhoReturning: number;
	beta: number;
	carry: number;
	drift: number;
	scoreCommon: number;
	scoreQ: number;
};

export type OprParams = {
	rest: CompParams;
	robot: CompParams;
	parts: PartParams;
	het: number;
	robotVar: number;
	imbFit: number;
	imbPred: number;
	floor: number;
	width: number;
};

export const OPR_PARAMS: OprParams = {
	rest: {
		lamNew: 2.5,
		lamReturning: 2,
		rhoNew: 0.2,
		rhoReturning: 0.4,
		rhoNewScore: 0.5,
		rhoReturningScore: 0.7,
		beta: 0.5,
		q: 0.15,
		qWeek: 0.015,
		carry: 1,
		drift: 0.25
	},
	robot: {
		lamNew: 0.432,
		lamReturning: 1.2,
		rhoNew: 0.125,
		rhoReturning: 0.4,
		rhoNewScore: 0.5,
		rhoReturningScore: 0.7,
		beta: 0.5,
		q: 0.375,
		qWeek: 0.025,
		carry: 1.1,
		drift: 0.25
	},
	parts: {
		rhoNew: 0.5,
		rhoReturning: 0.7,
		beta: 0.5,
		carry: 1,
		drift: 0.25,
		scoreCommon: 0.1,
		scoreQ: 0.05
	},
	het: 0.45,
	robotVar: 1,
	imbFit: 0.1,
	imbPred: 0.2,
	floor: 0,
	width: 0.25
};

export const MODEL_VERSION = 2;

export const HISTORY = [1, 0.45, 0.15];

export type RobotBase = { np: number; robot: number };

export const ROBOT_BASE: RobotBase = { np: 88.05730998031801, robot: 15.613071938786794 };

const BASE_WEIGHT = 20;

export const SCORE_SIGMA = 0.49;

export type PriorRel = [rest: number, robot: number];

export type SeasonStats = {
	mean: number;
	sd: number;
	robot: number;
	parts: number[];
	matches: number;
};

export type CompState = { mu: number; nu: number; prec: number; ref: number };

export type TeamState = {
	rest: CompState;
	robot: CompState;
	parts: number[];
	refs: number[];
	day: number;
};

export type Rating = {
	team: number;
	opr: number;
	strength: number;
	sd: number;
	matches: number;
	components: Record<Component, number>;
};

export type AllianceForecast = {
	strength: number;
	score: number;
	variance: number;
	components: Record<Component, number>;
};

export type Forecast = {
	red: AllianceForecast;
	blue: AllianceForecast;
	marginVariance: number;
	uncertainty: number;
	stats: SeasonStats;
};

export type RatingStep = {
	key: string;
	time: number;
	forecast: Forecast;
	swarm: { red: number; blue: number };
	ratings: { team: number; before: number; after: number }[];
};

export type EventRatings = {
	code: string;
	rater: EventRater;
	steps: RatingStep[];
	ratings: Rating[];
};

export type Priors = {
	params: OprParams;
	states: Map<number, TeamState>;
	previous: Map<number, PriorRel>;
};

export type PackedPrevious = { scale: number; teams: number[]; rest: number[]; robot: number[] };

export function packPrevious(previous: Map<number, PriorRel>, scale = 1000): PackedPrevious {
	const sorted = [...previous].sort((a, b) => a[0] - b[0]);
	return {
		scale,
		teams: sorted.map(([team], k) => team - (k > 0 ? sorted[k - 1][0] : 0)),
		rest: sorted.map(([, rel]) => Math.round(rel[0] * scale)),
		robot: sorted.map(([, rel]) => Math.round(rel[1] * scale))
	};
}

export function previousFrom(packed: PackedPrevious): Map<number, PriorRel> {
	const out = new Map<number, PriorRel>();
	let team = 0;
	packed.teams.forEach((step, k) => {
		team += step;
		out.set(team, [packed.rest[k] / packed.scale, packed.robot[k] / packed.scale]);
	});
	return out;
}

export function blendPrevious(
	seasons: Map<number, PriorRel>[],
	weights: number[] = HISTORY
): Map<number, PriorRel> {
	const sums = new Map<number, PriorRel>();
	const totals = new Map<number, number>();
	for (let j = 0; j < weights.length && j < seasons.length; j++) {
		const w = weights[j];
		if (w <= 0) continue;
		for (const [team, [rest, robot]] of seasons[j]) {
			const sum = sums.get(team) ?? [0, 0];
			sums.set(team, [sum[0] + w * rest, sum[1] + w * robot]);
			totals.set(team, (totals.get(team) ?? 0) + w);
		}
	}
	const out = new Map<number, PriorRel>();
	for (const [team, total] of totals) {
		const [rest, robot] = sums.get(team)!;
		out.set(team, [rest / total, robot / total]);
	}
	return out;
}

export function dayNumber(date: string): number {
	return Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

export function softFloor(v: number, floor: number, width: number): number {
	const t = (v - floor) / width;
	return floor + width * (t > 30 ? t : Math.log1p(Math.exp(t)));
}

function detailValue(detail: AllianceDetail | undefined, c: Component): number | undefined {
	const v = detail?.[DETAIL_KEY[c]];
	return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function robotPoints(
	teams: number[],
	np: number,
	detail: AllianceDetail | undefined
): number[] | null {
	const robots = detail?.robotSwarm;
	if (!robots || robots.length !== teams.length) return null;
	let total = 0;
	for (const r of robots) {
		if (!Number.isFinite(r)) return null;
		total += r;
	}
	return total > np ? null : robots;
}

type CompPrior = { mu: number; nu: number; prec: number };

function compPrior(
	p: CompParams,
	state: CompState | undefined,
	prev: number | undefined,
	mean: number,
	weeks: number
): CompPrior {
	if (!state) {
		if (prev === undefined)
			return { mu: (mean / 2) * p.rhoNew, nu: (mean / 2) * p.rhoNewScore, prec: p.lamNew };
		const b = p.beta * (prev - 1);
		return {
			mu: (mean / 2) * (p.rhoReturning + b),
			nu: (mean / 2) * (p.rhoReturningScore + b),
			prec: p.lamReturning
		};
	}
	const ref = state.ref;
	const scale = ref > 0 && mean > 0 ? (mean / ref) ** p.drift : 1;
	const carried = (x: number) => {
		const rel = ref > 0 ? x / (ref / 2) : 1;
		return (1 + p.carry * (rel - 1)) * (ref / 2) * scale;
	};
	return {
		mu: carried(state.mu),
		nu: carried(state.nu),
		prec: 1 / (1 / state.prec + p.q + p.qWeek * weeks)
	};
}

export type TeamPrior = { rest: CompPrior; robot: CompPrior; parts: number[] };

export function priorFor(team: number, priors: Priors, stats: SeasonStats, day: number): TeamPrior {
	const p = priors.params;
	const state = priors.states.get(team);
	const restMean = stats.mean - stats.robot;
	if (!state) {
		const prev = priors.previous.get(team);
		const total =
			prev === undefined
				? undefined
				: stats.mean > 0
					? (prev[0] * restMean + prev[1] * stats.robot) / stats.mean
					: prev[0];
		const pp = p.parts;
		const rel = total === undefined ? pp.rhoNew : pp.rhoReturning + pp.beta * (total - 1);
		return {
			rest: compPrior(p.rest, undefined, prev?.[0], restMean, 0),
			robot: compPrior(p.robot, undefined, prev?.[1], stats.robot, 0),
			parts: stats.parts.map((m) => (m / 2) * rel)
		};
	}
	const weeks = Math.max(0, day - state.day) / 7;
	const pp = p.parts;
	const ratio = (now: number, ref: number) => (ref > 0 && now > 0 ? (now / ref) ** pp.drift : 1);
	return {
		rest: compPrior(p.rest, state.rest, undefined, restMean, weeks),
		robot: compPrior(p.robot, state.robot, undefined, stats.robot, weeks),
		parts: state.parts.map((v, c) => {
			const scale = OWN_SCALE.has(c)
				? ratio(stats.parts[c], state.refs[c + 1])
				: ratio(stats.mean, state.refs[0]);
			return (pp.carry * v + (1 - pp.carry) * (state.refs[c + 1] / 2)) * scale;
		})
	};
}

function support(ph: Float64Array, nz: Int32Array): number {
	let count = 0;
	for (let k = 0; k < ph.length; k++) if (ph[k] !== 0) nz[count++] = k;
	return count;
}

function downdate(
	M: Float64Array,
	ph: Float64Array,
	nz: Int32Array,
	count: number,
	n: number,
	s: number
): void {
	for (let x = 0; x < count; x++) {
		const a = nz[x];
		const fa = ph[a] / s;
		const row = a * n;
		for (let y = 0; y < count; y++) M[row + nz[y]] -= fa * ph[nz[y]];
	}
}

function grown(old: Float64Array, n: number): Float64Array<ArrayBuffer> {
	const next = new Float64Array(n);
	next.set(old);
	return next;
}

function grownMatrix(old: Float64Array, from: number, n: number): Float64Array<ArrayBuffer> {
	const next = new Float64Array(n * n);
	for (let i = 0; i < from; i++) next.set(old.subarray(i * from, (i + 1) * from), i * n);
	return next;
}

const PART_COUNT = COMPONENTS.length;

export class EventRater {
	readonly code: string;
	readonly teams: number[] = [];
	private index = new Map<number, number>();
	private n = 0;
	private P = new Float64Array(0);
	private V = new Float64Array(0);
	private S = new Float64Array(0);
	private restMu = new Float64Array(0);
	private restNu = new Float64Array(0);
	private restBase = new Float64Array(0);
	private restBaseNu = new Float64Array(0);
	private robotMu = new Float64Array(0);
	private robotNu = new Float64Array(0);
	private robotBase = new Float64Array(0);
	private robotBaseNu = new Float64Array(0);
	private mu: Float64Array[] = [];
	private base: Float64Array[] = [];
	private played = new Int32Array(0);
	private ph = new Float64Array(0);
	private nz = new Int32Array(0);
	private priors: Priors;
	private stats: () => SeasonStats;
	private day: number;

	constructor(
		code: string,
		teams: number[],
		priors: Priors,
		stats: () => SeasonStats,
		day: number
	) {
		this.code = code;
		this.priors = priors;
		this.stats = stats;
		this.day = day;
		this.grow(teams);
	}

	private get params(): OprParams {
		return this.priors.params;
	}

	private grow(teams: number[]): void {
		const fresh = [...new Set(teams)].filter((t) => !this.index.has(t));
		if (!fresh.length) return;
		const old = this.n;
		const n = old + fresh.length;
		const P = grownMatrix(this.P, old, n);
		const S = grownMatrix(this.S, old, n);
		const V = grown(this.V, n);
		const restMu = grown(this.restMu, n);
		const restNu = grown(this.restNu, n);
		const restBase = grown(this.restBase, n);
		const restBaseNu = grown(this.restBaseNu, n);
		const robotMu = grown(this.robotMu, n);
		const robotNu = grown(this.robotNu, n);
		const robotBase = grown(this.robotBase, n);
		const robotBaseNu = grown(this.robotBaseNu, n);
		const mu = Array.from({ length: PART_COUNT }, (_, c) =>
			grown(this.mu[c] ?? new Float64Array(0), n)
		);
		const base = Array.from({ length: PART_COUNT }, (_, c) =>
			grown(this.base[c] ?? new Float64Array(0), n)
		);
		const played = new Int32Array(n);
		played.set(this.played);
		const common = this.params.parts.scoreCommon;
		const stats = this.stats();
		fresh.forEach((team, k) => {
			const i = old + k;
			this.index.set(team, i);
			this.teams.push(team);
			const prior = priorFor(team, this.priors, stats, this.day);
			restMu[i] = restBase[i] = prior.rest.mu;
			restNu[i] = restBaseNu[i] = prior.rest.nu;
			robotMu[i] = robotBase[i] = prior.robot.mu;
			robotNu[i] = robotBaseNu[i] = prior.robot.nu;
			for (let c = 0; c < PART_COUNT; c++) mu[c][i] = base[c][i] = prior.parts[c];
			P[i * n + i] = 1 / prior.rest.prec;
			V[i] = 1 / prior.robot.prec;
			for (let j = old; j < n; j++) S[i * n + j] = common;
			S[i * n + i] += 1 / prior.rest.prec;
		});
		this.n = n;
		this.P = P;
		this.S = S;
		this.V = V;
		this.restMu = restMu;
		this.restNu = restNu;
		this.restBase = restBase;
		this.restBaseNu = restBaseNu;
		this.robotMu = robotMu;
		this.robotNu = robotNu;
		this.robotBase = robotBase;
		this.robotBaseNu = robotBaseNu;
		this.mu = mu;
		this.base = base;
		this.played = played;
		this.ph = new Float64Array(n);
		this.nz = new Int32Array(n);
	}

	private refresh(team: number): void {
		const i = this.index.get(team)!;
		if (this.played[i] > 0) return;
		const prior = priorFor(team, this.priors, this.stats(), this.day);
		this.restMu[i] += prior.rest.mu - this.restBase[i];
		this.restNu[i] += prior.rest.nu - this.restBaseNu[i];
		this.restBase[i] = prior.rest.mu;
		this.restBaseNu[i] = prior.rest.nu;
		this.robotMu[i] += prior.robot.mu - this.robotBase[i];
		this.robotNu[i] += prior.robot.nu - this.robotBaseNu[i];
		this.robotBase[i] = prior.robot.mu;
		this.robotBaseNu[i] = prior.robot.nu;
		for (let c = 0; c < PART_COUNT; c++) {
			this.mu[c][i] += prior.parts[c] - this.base[c][i];
			this.base[c][i] = prior.parts[c];
		}
	}

	include(teams: number[]): void {
		this.grow(teams);
		for (const t of teams) this.refresh(t);
	}

	private half(): number {
		return this.stats().mean / 2 || 1;
	}

	private floored(total: number, half: number): number {
		const p = this.params;
		return softFloor(total / half, p.floor, p.width) * half;
	}

	private strengthOf(teams: number[], score: boolean): number {
		const half = this.half();
		const rest = score ? this.restNu : this.restMu;
		const robot = score ? this.robotNu : this.robotMu;
		const idx = teams.map((t) => this.index.get(t)!);
		let x = 0;
		for (const i of idx) x += this.floored(rest[i] + robot[i], half);
		if (idx.length === 2) x += this.params.imbPred * Math.abs(rest[idx[0]] - rest[idx[1]]);
		return x;
	}

	private quad(idx: number[], sign: number[], M: Float64Array): number {
		const n = this.n;
		let v = 0;
		for (let a = 0; a < idx.length; a++) {
			const row = idx[a] * n;
			for (let b = 0; b < idx.length; b++) v += sign[a] * sign[b] * M[row + idx[b]];
		}
		return v;
	}

	forecast(red: number[], blue: number[]): Forecast {
		this.include([...red, ...blue]);
		const side = (teams: number[]): AllianceForecast => {
			const idx = teams.map((t) => this.index.get(t)!);
			return {
				strength: this.strengthOf(teams, false),
				score: this.strengthOf(teams, true),
				variance:
					this.quad(
						idx,
						idx.map(() => 1),
						this.S
					) + 1,
				components: Object.fromEntries(
					COMPONENTS.map((c, k) => {
						let s = 0;
						for (const i of idx) s += this.mu[k][i];
						return [c, s];
					})
				) as Record<Component, number>
			};
		};
		const idx = [...red, ...blue].map((t) => this.index.get(t)!);
		const sign = [...red.map(() => 1), ...blue.map(() => -1)];
		let v = this.quad(idx, sign, this.P);
		let robot = 0;
		for (let a = 0; a < idx.length; a++) robot += sign[a] * sign[a] * this.V[idx[a]];
		v += this.params.robotVar * robot;
		let uncertainty = 0;
		for (const i of idx) uncertainty += 1 / (1 + this.played[i]);
		return {
			red: side(red),
			blue: side(blue),
			marginVariance: v + 2,
			uncertainty,
			stats: this.stats()
		};
	}

	private observeRobot(i: number, y: number): void {
		const pii = this.V[i];
		const s = pii + 1;
		const g = pii / s;
		this.robotMu[i] += g * (y - this.robotMu[i]);
		this.robotNu[i] += g * (y - this.robotNu[i]);
		this.V[i] = pii - g * pii;
	}

	private observeRest(idx: number[], h: number[], y: number, r: number): void {
		const n = this.n;
		const P = this.P;
		const ph = this.ph;
		ph.fill(0);
		for (let a = 0; a < idx.length; a++) {
			const w = h[a];
			if (w === 0) continue;
			const row = idx[a] * n;
			for (let k = 0; k < n; k++) ph[k] += w * P[row + k];
		}
		let hph = 0;
		let pred = 0;
		let predNu = 0;
		for (let a = 0; a < idx.length; a++) {
			hph += h[a] * ph[idx[a]];
			pred += h[a] * this.restMu[idx[a]];
			predNu += h[a] * this.restNu[idx[a]];
		}
		const s = hph + r;
		const resid = y - pred;
		const residNu = y - predNu;
		const count = support(ph, this.nz);
		for (let x = 0; x < count; x++) {
			const k = this.nz[x];
			const g = ph[k] / s;
			this.restMu[k] += g * resid;
			this.restNu[k] += g * residNu;
		}
		downdate(P, ph, this.nz, count, n, s);
	}

	private observeSide(all: number[], present: number[], y: number, robots: number[] | null): void {
		const p = this.params;
		const stats = this.stats();
		const idx = present.map((t) => this.index.get(t)!);
		let target = y;
		if (robots) {
			present.forEach((t, k) => this.observeRobot(idx[k], robots[all.indexOf(t)]));
			let total = 0;
			for (const r of robots) total += r;
			target -= total;
		} else {
			for (const i of idx) target -= this.robotMu[i];
		}
		let r = 1;
		const restMean = stats.mean - stats.robot;
		if (p.het !== 0 && restMean > 0) {
			let pred = 0;
			for (const i of idx) pred += this.restMu[i];
			r = Math.min(Math.max(pred / restMean, 0.25), 4) ** p.het;
		}
		const half = stats.mean / 2 || 1;
		let adj = 0;
		const h = idx.map((i) => {
			const total = this.restMu[i] + this.robotMu[i];
			const slope = 1 / (1 + Math.exp(-((total / half - p.floor) / p.width)));
			adj += softFloor(total / half, p.floor, p.width) * half - total;
			adj += (1 - slope) * this.restMu[i];
			return slope;
		});
		if (p.imbFit !== 0 && idx.length === 2) {
			const sgn = Math.sign(this.restNu[idx[0]] - this.restNu[idx[1]]);
			h[0] *= 1 + p.imbFit * sgn;
			h[1] *= 1 - p.imbFit * sgn;
		}
		this.observeRest(idx, h, target - adj, r);
	}

	private observeParts(teams: number[], detail: AllianceDetail | undefined): void {
		const n = this.n;
		const idx = teams.map((t) => this.index.get(t)!);
		const ph = this.ph;
		ph.fill(0);
		for (const i of idx) {
			const row = i * n;
			for (let k = 0; k < n; k++) ph[k] += this.S[row + k];
		}
		let total = 0;
		for (const i of idx) total += ph[i];
		const s = total + 1;
		const count = support(ph, this.nz);
		COMPONENTS.forEach((c, k) => {
			const y = detailValue(detail, c);
			if (y === undefined) return;
			const mu = this.mu[k];
			let pred = 0;
			for (const i of idx) pred += mu[i];
			const resid = y - pred;
			for (let x = 0; x < count; x++) mu[this.nz[x]] += (ph[this.nz[x]] / s) * resid;
		});
		downdate(this.S, ph, this.nz, count, n, s);
	}

	update(m: ModelMatch): void {
		if (m.redNp === null || m.blueNp === null) return;
		this.include([...m.red, ...m.blue]);
		const absent = new Set(m.noShows ?? []);
		const dq = new Set(m.dqs ?? []);
		const sides: [number[], number, AllianceDetail | undefined][] = [
			[m.red, m.redNp, m.redDetail],
			[m.blue, m.blueNp, m.blueDetail]
		];
		const credited = [...m.red, ...m.blue].filter((t) => !absent.has(t));
		const q = this.params.parts.scoreQ;
		for (const t of credited) {
			const i = this.index.get(t)!;
			this.S[i * this.n + i] += q;
		}
		for (const [teams, np, detail] of sides) {
			const present = teams.filter((t) => !absent.has(t));
			const disqualified = m.level === 'playoff' && teams.some((t) => dq.has(t));
			if (!present.length || disqualified) continue;
			this.observeSide(teams, present, np, robotPoints(teams, np, detail));
			this.observeParts(present, detail);
		}
		for (const t of credited) this.played[this.index.get(t)!]++;
	}

	has(team: number): boolean {
		return this.index.has(team);
	}

	matchesPlayed(team: number): number {
		const i = this.index.get(team);
		return i === undefined ? 0 : this.played[i];
	}

	private opr(i: number): number {
		return this.floored(this.restNu[i] + this.robotNu[i], this.half());
	}

	private part(i: number, k: number): number {
		const v = this.mu[k][i];
		if (!POINT_PARTS.has(k)) return v;
		let total = 0;
		for (const c of SPLIT) total += this.mu[c][i];
		return total > 0 ? v * (this.opr(i) / total) : v;
	}

	value(team: number, track: Track = 'opr'): number {
		const i = this.index.get(team);
		if (i === undefined) return NaN;
		if (track === 'strength') return this.floored(this.restMu[i] + this.robotMu[i], this.half());
		if (track === 'opr') return this.opr(i);
		return this.part(i, COMPONENTS.indexOf(track));
	}

	rating(team: number, sigma: number): Rating {
		const i = this.index.get(team)!;
		return {
			team,
			opr: this.value(team, 'opr'),
			strength: this.value(team, 'strength'),
			sd: sigma * Math.sqrt(Math.max(this.P[i * this.n + i] + this.V[i], 0)),
			matches: this.played[i],
			components: Object.fromEntries(COMPONENTS.map((c, k) => [c, this.part(i, k)])) as Record<
				Component,
				number
			>
		};
	}

	carry(): Map<number, TeamState> {
		const out = new Map<number, TeamState>();
		const stats = this.stats();
		const refs = [stats.mean, ...stats.parts];
		const restRef = stats.mean - stats.robot;
		for (const [team, i] of this.index) {
			if (this.played[i] === 0) continue;
			out.set(team, {
				rest: {
					mu: this.restMu[i],
					nu: this.restNu[i],
					prec: 1 / Math.max(this.P[i * this.n + i], 1e-9),
					ref: restRef
				},
				robot: {
					mu: this.robotMu[i],
					nu: this.robotNu[i],
					prec: 1 / Math.max(this.V[i], 1e-9),
					ref: stats.robot
				},
				parts: this.mu.map((m) => m[i]),
				refs,
				day: this.day
			});
		}
		return out;
	}
}

export type Sums = {
	w: number;
	s: number;
	ss: number;
	parts: number[];
	rw: number;
	rnp: number;
	robot: number;
};

export const emptySums = (): Sums => ({
	w: 0,
	s: 0,
	ss: 0,
	parts: COMPONENTS.map(() => 0),
	rw: 0,
	rnp: 0,
	robot: 0
});

export function statsOf(a: Sums, b: Sums = emptySums(), base: RobotBase = ROBOT_BASE): SeasonStats {
	const w = a.w + b.w;
	if (w <= 0) return { mean: 0, sd: 1, robot: 0, parts: COMPONENTS.map(() => 0), matches: 0 };
	const mean = (a.s + b.s) / w;
	const variance = Math.max((a.ss + b.ss) / w - mean * mean, 1e-6);
	const rw = a.rw + b.rw + BASE_WEIGHT;
	const np = Math.max((a.rnp + b.rnp + BASE_WEIGHT * base.np) / rw, 1e-6);
	const robot = (a.robot + b.robot + BASE_WEIGHT * base.robot) / rw;
	return {
		mean,
		sd: Math.sqrt(variance),
		robot: (mean * robot) / np,
		parts: a.parts.map((p, k) => (p + b.parts[k]) / w),
		matches: w
	};
}

export function addSums(into: Sums, from: Sums): void {
	into.w += from.w;
	into.s += from.s;
	into.ss += from.ss;
	from.parts.forEach((p, k) => (into.parts[k] += p));
	into.rw += from.rw;
	into.rnp += from.rnp;
	into.robot += from.robot;
}

function addSide(
	sums: Sums,
	np: number,
	detail: AllianceDetail | undefined,
	robots: number[] | null
): void {
	sums.w += 1;
	sums.s += np;
	sums.ss += np * np;
	COMPONENTS.forEach((c, k) => {
		sums.parts[k] += detailValue(detail, c) ?? 0;
	});
	if (!robots) return;
	let total = 0;
	for (const r of robots) total += r;
	sums.rw += 1;
	sums.rnp += np;
	sums.robot += total;
}

export function orderMatches(matches: ModelMatch[]): ModelMatch[] {
	const quals = matches
		.filter((m) => m.level === 'qual')
		.sort((a, b) => (a.number ?? a.time) - (b.number ?? b.time) || a.time - b.time);
	const playoffs = matches
		.filter((m) => m.level === 'playoff')
		.sort(
			(a, b) =>
				a.time - b.time || (a.series ?? 0) - (b.series ?? 0) || (a.number ?? 0) - (b.number ?? 0)
		);
	return [...quals, ...playoffs];
}

export function orderEvents(events: ModelEvent[]): ModelEvent[] {
	return [...events].sort(
		(a, b) =>
			a.start.localeCompare(b.start) ||
			(a.end ?? a.start).localeCompare(b.end ?? b.start) ||
			b.matches.length - a.matches.length ||
			a.code.localeCompare(b.code)
	);
}

export type SeasonRatings = {
	events: Map<string, EventRatings>;
	states: Map<number, TeamState>;
	stats: SeasonStats;
	latest: Map<number, Rating>;
	relative: Map<number, PriorRel>;
	base: RobotBase;
	swarm: SwarmBook;
};

export type SeasonOptions = {
	previous?: Map<number, PriorRel>;
	states?: Map<number, TeamState>;
	sums?: Sums;
	swarm?: SwarmBook;
	params?: OprParams;
	base?: RobotBase;
	sigma?: number;
	onForecast?: (event: ModelEvent, match: ModelMatch, forecast: Forecast) => void;
};

function credits(m: ModelMatch): [number, AllianceDetail | undefined, number[] | null][] {
	if (!plausibleMatch(m)) return [];
	const absent = new Set(m.noShows ?? []);
	const dq = new Set(m.dqs ?? []);
	const out: [number, AllianceDetail | undefined, number[] | null][] = [];
	for (const [teams, np, detail] of [
		[m.red, m.redNp, m.redDetail],
		[m.blue, m.blueNp, m.blueDetail]
	] as const) {
		if (np === null || !teams.some((t) => !absent.has(t))) continue;
		if (m.level === 'playoff' && teams.some((t) => dq.has(t))) continue;
		out.push([np, detail, robotPoints(teams, np, detail)]);
	}
	return out;
}

export function matchSums(matches: ModelMatch[]): Sums {
	const sums = emptySums();
	for (const m of matches) for (const side of credits(m)) addSide(sums, ...side);
	return sums;
}

function relOf(state: CompState): number {
	return state.ref > 0 ? state.mu / (state.ref / 2) : 1;
}

export function rateSeason(events: ModelEvent[], options: SeasonOptions = {}): SeasonRatings {
	const priors: Priors = {
		params: options.params ?? OPR_PARAMS,
		states: new Map(options.states ?? []),
		previous: options.previous ?? new Map()
	};
	const base = options.base ?? ROBOT_BASE;
	const sigmaRel = options.sigma ?? SCORE_SIGMA;
	const global = emptySums();
	if (options.sums) addSums(global, options.sums);
	const out = new Map<string, EventRatings>();
	const latest = new Map<number, Rating>();
	const relative = new Map<number, PriorRel>();
	const ordered = orderEvents(events);
	const swarm = options.swarm ?? new SwarmBook();
	let i = 0;
	while (i < ordered.length) {
		const day = dayNumber(ordered[i].start);
		const snapshot: Sums = { ...global, parts: [...global.parts] };
		const added = emptySums();
		while (i < ordered.length && dayNumber(ordered[i].start) === day) {
			const event = ordered[i++];
			const local = emptySums();
			const stats = () => statsOf(snapshot, local, base);
			const matches = orderMatches(event.matches);
			const teams = [...new Set(matches.flatMap((m) => [...m.red, ...m.blue]))];
			const rater = new EventRater(event.code, teams, priors, stats, day);
			swarm.enterEvent(event.code, teams);
			const steps: RatingStep[] = [];
			for (const m of matches) {
				if (!rated(m)) continue;
				const forecast = rater.forecast(m.red, m.blue);
				options.onForecast?.(event, m, forecast);
				const members = [...m.red, ...m.blue];
				const before = members.map((t) => rater.value(t));
				const chances = { red: swarm.chance(m.red), blue: swarm.chance(m.blue) };
				rater.update(m);
				swarm.update(m);
				steps.push({
					key: m.key,
					time: m.time,
					forecast,
					swarm: chances,
					ratings: members.map((team, k) => ({ team, before: before[k], after: rater.value(team) }))
				});
				for (const side of credits(m)) addSide(local, ...side);
			}
			const end = stats();
			const ratings = rater.teams
				.filter((t) => rater.matchesPlayed(t) > 0)
				.map((t) => rater.rating(t, sigmaRel * end.sd));
			for (const [team, state] of rater.carry()) {
				priors.states.set(team, state);
				relative.set(team, [relOf(state.rest), relOf(state.robot)]);
			}
			for (const r of ratings) latest.set(r.team, r);
			out.set(event.code, { code: event.code, rater, steps, ratings });
			addSums(added, local);
		}
		addSums(global, added);
	}
	return {
		events: out,
		states: priors.states,
		stats: statsOf(global, emptySums(), base),
		latest,
		relative,
		base: global.rw > 0 ? { np: global.rnp / global.rw, robot: global.robot / global.rw } : base,
		swarm
	};
}
