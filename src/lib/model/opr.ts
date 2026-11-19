import type { AllianceDetail, ModelEvent, ModelMatch } from './types.ts';

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

const STRENGTH = 0;
const OPR = 1;
const SIZE = COMPONENTS.length + 2;
const OWN_SCALE = new Set<number>([COMPONENTS.indexOf('tips') + 2, COMPONENTS.indexOf('fouls') + 2]);

function trackIndex(track: Track): number {
	if (track === 'strength') return STRENGTH;
	if (track === 'opr') return OPR;
	return COMPONENTS.indexOf(track) + 2;
}

export type OprParams = {
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

export const OPR_PARAMS: OprParams = {
	lamNew: 2.4,
	lamReturning: 2,
	rhoNew: 0.2,
	rhoReturning: 0.4,
	rhoNewScore: 0.8,
	rhoReturningScore: 0.9,
	beta: 0.6,
	q: 0.1,
	qWeek: 0.02,
	carry: 1,
	drift: 0.25
};

export const SCORE_SIGMA = 0.8;

export type SeasonStats = { mean: number; sd: number; parts: number[]; matches: number };

export type TeamState = {
	values: number[];
	prec: number;
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
	previous: Map<number, number>;
};

export function dayNumber(date: string): number {
	return Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

function detailValue(detail: AllianceDetail | undefined, c: Component): number | undefined {
	const v = detail?.[DETAIL_KEY[c]];
	return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function means(stats: SeasonStats): number[] {
	return [stats.mean, stats.mean, ...stats.parts];
}

export function priorFor(
	team: number,
	priors: Priors,
	stats: SeasonStats,
	day: number
): { values: number[]; prec: number } {
	const p = priors.params;
	const m = means(stats);
	const state = priors.states.get(team);
	if (!state) {
		const prev = priors.previous.get(team);
		const lift = prev === undefined ? 0 : p.beta * (prev - 1);
		const rel = (prev === undefined ? p.rhoNew : p.rhoReturning) + lift;
		const relScore = (prev === undefined ? p.rhoNewScore : p.rhoReturningScore) + lift;
		return {
			values: m.map((v, c) => (v / 2) * (c === STRENGTH ? rel : relScore)),
			prec: prev === undefined ? p.lamNew : p.lamReturning
		};
	}
	const ratio = (c: number) => (state.refs[c] > 0 && m[c] > 0 ? (m[c] / state.refs[c]) ** p.drift : 1);
	const values = state.values.map((v, c) => {
		const scale = OWN_SCALE.has(c) ? ratio(c) : ratio(STRENGTH);
		return (p.carry * v + (1 - p.carry) * (state.refs[c] / 2)) * scale;
	});
	const weeks = Math.max(0, day - state.day) / 7;
	return { values, prec: 1 / (1 / state.prec + p.q + p.qWeek * weeks) };
}

export class EventRater {
	readonly code: string;
	readonly teams: number[] = [];
	private index = new Map<number, number>();
	private n = 0;
	private P = new Float64Array(0);
	private mu: Float64Array[] = [];
	private played = new Int32Array(0);
	private ph = new Float64Array(0);
	private priors: Priors;
	private stats: () => SeasonStats;
	private day: number;

	constructor(code: string, teams: number[], priors: Priors, stats: () => SeasonStats, day: number) {
		this.code = code;
		this.priors = priors;
		this.stats = stats;
		this.day = day;
		this.grow(teams);
	}

	private grow(teams: number[]): void {
		const fresh = [...new Set(teams)].filter((t) => !this.index.has(t));
		if (!fresh.length) return;
		const old = this.n;
		const n = old + fresh.length;
		const P = new Float64Array(n * n);
		for (let i = 0; i < old; i++) P.set(this.P.subarray(i * old, (i + 1) * old), i * n);
		const mu = Array.from({ length: SIZE }, (_, c) => {
			const next = new Float64Array(n);
			if (this.mu[c]) next.set(this.mu[c]);
			return next;
		});
		const played = new Int32Array(n);
		played.set(this.played);
		const stats = this.stats();
		fresh.forEach((team, k) => {
			const i = old + k;
			this.index.set(team, i);
			this.teams.push(team);
			const prior = priorFor(team, this.priors, stats, this.day);
			for (let c = 0; c < SIZE; c++) mu[c][i] = prior.values[c];
			P[i * n + i] = 1 / prior.prec;
		});
		this.n = n;
		this.P = P;
		this.mu = mu;
		this.played = played;
		this.ph = new Float64Array(n);
	}

	private refresh(team: number): void {
		const i = this.index.get(team)!;
		if (this.played[i] > 0) return;
		const prior = priorFor(team, this.priors, this.stats(), this.day);
		for (let c = 0; c < SIZE; c++) this.mu[c][i] = prior.values[c];
	}

	private sum(teams: number[], c: number): number {
		let s = 0;
		for (const t of teams) s += this.mu[c][this.index.get(t)!];
		return s;
	}

	private quad(weights: Map<number, number>): number {
		const n = this.n;
		let v = 0;
		for (const [a, wa] of weights) for (const [b, wb] of weights) v += wa * wb * this.P[a * n + b];
		return v;
	}

	private weights(red: number[], blue: number[] = []): Map<number, number> {
		const w = new Map<number, number>();
		for (const t of red) w.set(this.index.get(t)!, (w.get(this.index.get(t)!) ?? 0) + 1);
		for (const t of blue) w.set(this.index.get(t)!, (w.get(this.index.get(t)!) ?? 0) - 1);
		return w;
	}

	forecast(red: number[], blue: number[]): Forecast {
		this.grow([...red, ...blue]);
		for (const t of [...red, ...blue]) this.refresh(t);
		const side = (teams: number[]): AllianceForecast => ({
			strength: this.sum(teams, STRENGTH),
			score: this.sum(teams, OPR),
			variance: this.quad(this.weights(teams)) + 1,
			components: Object.fromEntries(COMPONENTS.map((c, k) => [c, this.sum(teams, k + 2)])) as Record<
				Component,
				number
			>
		});
		let uncertainty = 0;
		for (const t of [...red, ...blue]) uncertainty += 1 / (1 + this.played[this.index.get(t)!]);
		return {
			red: side(red),
			blue: side(blue),
			marginVariance: this.quad(this.weights(red, blue)) + 2,
			uncertainty,
			stats: this.stats()
		};
	}

	private observe(teams: number[], values: (number | undefined)[]): void {
		const n = this.n;
		const P = this.P;
		const ph = this.ph;
		const idx = teams.map((t) => this.index.get(t)!);
		ph.fill(0);
		for (const i of idx) {
			const row = i * n;
			for (let k = 0; k < n; k++) ph[k] += P[row + k];
		}
		let hph = 0;
		for (const i of idx) hph += ph[i];
		const s = hph + 1;
		for (let c = 0; c < SIZE; c++) {
			const y = values[c];
			if (y === undefined) continue;
			const mu = this.mu[c];
			let pred = 0;
			for (const i of idx) pred += mu[i];
			const resid = y - pred;
			for (let k = 0; k < n; k++) mu[k] += (ph[k] / s) * resid;
		}
		for (let a = 0; a < n; a++) {
			const fa = ph[a] / s;
			if (fa === 0) continue;
			const row = a * n;
			for (let b = 0; b < n; b++) P[row + b] -= fa * ph[b];
		}
	}

	update(m: ModelMatch): void {
		if (m.redNp === null || m.blueNp === null) return;
		this.grow([...m.red, ...m.blue]);
		for (const t of [...m.red, ...m.blue]) this.refresh(t);
		const absent = new Set(m.noShows ?? []);
		const dq = new Set(m.dqs ?? []);
		const sides: [number[], number, AllianceDetail | undefined][] = [
			[m.red, m.redNp, m.redDetail],
			[m.blue, m.blueNp, m.blueDetail]
		];
		const credited: number[] = [];
		for (const [teams, np, detail] of sides) {
			const present = teams.filter((t) => !absent.has(t));
			credited.push(...present);
			const disqualified = m.level === 'playoff' && teams.some((t) => dq.has(t));
			if (!present.length || disqualified) continue;
			this.observe(present, [np, np, ...COMPONENTS.map((c) => detailValue(detail, c))]);
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

	value(team: number, track: Track = 'opr'): number {
		const i = this.index.get(team);
		if (i === undefined) return NaN;
		return this.mu[trackIndex(track)][i];
	}

	rating(team: number, sigma: number): Rating {
		const i = this.index.get(team)!;
		return {
			team,
			opr: this.mu[OPR][i],
			strength: this.mu[STRENGTH][i],
			sd: sigma * Math.sqrt(Math.max(this.P[i * this.n + i], 0)),
			matches: this.played[i],
			components: Object.fromEntries(COMPONENTS.map((c, k) => [c, this.mu[k + 2][i]])) as Record<Component, number>
		};
	}

	carry(): Map<number, TeamState> {
		const out = new Map<number, TeamState>();
		const refs = means(this.stats());
		for (const [team, i] of this.index) {
			if (this.played[i] === 0) continue;
			out.set(team, {
				values: this.mu.map((m) => m[i]),
				prec: 1 / Math.max(this.P[i * this.n + i], 1e-9),
				refs,
				day: this.day
			});
		}
		return out;
	}
}

type Sums = { w: number; s: number; ss: number; parts: number[] };

const emptySums = (): Sums => ({ w: 0, s: 0, ss: 0, parts: COMPONENTS.map(() => 0) });

function statsOf(a: Sums, b: Sums): SeasonStats {
	const w = a.w + b.w;
	if (w <= 0) return { mean: 0, sd: 1, parts: COMPONENTS.map(() => 0), matches: 0 };
	const mean = (a.s + b.s) / w;
	const variance = Math.max((a.ss + b.ss) / w - mean * mean, 1e-6);
	return { mean, sd: Math.sqrt(variance), parts: a.parts.map((p, k) => (p + b.parts[k]) / w), matches: w };
}

function addSums(into: Sums, from: Sums): void {
	into.w += from.w;
	into.s += from.s;
	into.ss += from.ss;
	from.parts.forEach((p, k) => (into.parts[k] += p));
}

function addSide(sums: Sums, np: number, detail: AllianceDetail | undefined): void {
	sums.w += 1;
	sums.s += np;
	sums.ss += np * np;
	COMPONENTS.forEach((c, k) => {
		sums.parts[k] += detailValue(detail, c) ?? 0;
	});
}

export function orderMatches(matches: ModelMatch[]): ModelMatch[] {
	const quals = matches
		.filter((m) => m.level === 'qual')
		.sort((a, b) => (a.number ?? a.time) - (b.number ?? b.time) || a.time - b.time);
	const playoffs = matches
		.filter((m) => m.level === 'playoff')
		.sort((a, b) => a.time - b.time || (a.series ?? 0) - (b.series ?? 0) || (a.number ?? 0) - (b.number ?? 0));
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
	relative: Map<number, number>;
};

export type SeasonOptions = {
	previous?: Map<number, number>;
	params?: OprParams;
	sigma?: number;
	onForecast?: (event: ModelEvent, match: ModelMatch, forecast: Forecast) => void;
};

function credits(m: ModelMatch): [number, AllianceDetail | undefined][] {
	const absent = new Set(m.noShows ?? []);
	const dq = new Set(m.dqs ?? []);
	const out: [number, AllianceDetail | undefined][] = [];
	for (const [teams, np, detail] of [
		[m.red, m.redNp, m.redDetail],
		[m.blue, m.blueNp, m.blueDetail]
	] as const) {
		if (np === null || !teams.some((t) => !absent.has(t))) continue;
		if (m.level === 'playoff' && teams.some((t) => dq.has(t))) continue;
		out.push([np, detail]);
	}
	return out;
}

export function rateSeason(events: ModelEvent[], options: SeasonOptions = {}): SeasonRatings {
	const priors: Priors = {
		params: options.params ?? OPR_PARAMS,
		states: new Map(),
		previous: options.previous ?? new Map()
	};
	const sigmaRel = options.sigma ?? SCORE_SIGMA;
	const global = emptySums();
	const out = new Map<string, EventRatings>();
	const latest = new Map<number, Rating>();
	const relative = new Map<number, number>();
	const ordered = orderEvents(events);
	let i = 0;
	while (i < ordered.length) {
		const day = dayNumber(ordered[i].start);
		const snapshot: Sums = { ...global, parts: [...global.parts] };
		const added = emptySums();
		while (i < ordered.length && dayNumber(ordered[i].start) === day) {
			const event = ordered[i++];
			const local = emptySums();
			const stats = () => statsOf(snapshot, local);
			const matches = orderMatches(event.matches);
			const teams = [...new Set(matches.flatMap((m) => [...m.red, ...m.blue]))];
			const rater = new EventRater(event.code, teams, priors, stats, day);
			const steps: RatingStep[] = [];
			for (const m of matches) {
				if (m.redNp === null || m.blueNp === null) continue;
				const forecast = rater.forecast(m.red, m.blue);
				options.onForecast?.(event, m, forecast);
				const members = [...m.red, ...m.blue];
				const before = members.map((t) => rater.value(t));
				rater.update(m);
				steps.push({
					key: m.key,
					time: m.time,
					forecast,
					ratings: members.map((team, k) => ({ team, before: before[k], after: rater.value(team) }))
				});
				for (const [np, detail] of credits(m)) addSide(local, np, detail);
			}
			const end = stats();
			const ratings = rater.teams
				.filter((t) => rater.matchesPlayed(t) > 0)
				.map((t) => rater.rating(t, sigmaRel * end.sd));
			for (const [team, state] of rater.carry()) {
				priors.states.set(team, state);
				relative.set(team, end.mean > 0 ? state.values[STRENGTH] / (end.mean / 2) : 1);
			}
			for (const r of ratings) latest.set(r.team, r);
			out.set(event.code, { code: event.code, rater, steps, ratings });
			addSums(added, local);
		}
		addSums(global, added);
	}
	return { events: out, states: priors.states, stats: statsOf(global, emptySums()), latest, relative };
}
