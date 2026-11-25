export type CompParams = {
	lamNew: number;
	lamPrev: number;
	q: number;
	qWeek: number;
	qMatch: number;
	carry: number;
	drift: number;
	beta: number;
	rhoNew: number;
	rhoPrev: number;
	rhoNewScore: number;
	rhoPrevScore: number;
};

type State = { mu: number; nu: number; prec: number; meanRef: number; day: number };

export function shippedComp(p: Record<string, number | string | boolean | null>): CompParams {
	return {
		lamNew: p.lamNew as number,
		lamPrev: p.lamPrevSeason as number,
		q: p.q as number,
		qWeek: p.qWeek as number,
		qMatch: p.qMatch as number,
		carry: p.carry as number,
		drift: p.drift as number,
		beta: p.beta as number,
		rhoNew: p.rhoNew as number,
		rhoPrev: p.rhoPrev as number,
		rhoNewScore: (p.rhoNewScore ?? p.rhoNew) as number,
		rhoPrevScore: (p.rhoPrevScore ?? p.rhoPrev) as number
	};
}

export class Comp {
	p: CompParams;
	teams = new Map<number, State>();
	prevRel = new Map<number, number>();
	index = new Map<number, number>();
	n = 0;
	mu = new Float64Array(0);
	nu = new Float64Array(0);
	prior = new Float64Array(0);
	priorNu = new Float64Array(0);
	P = new Float64Array(0);
	played = new Int32Array(0);
	ph = new Float64Array(0);

	constructor(p: CompParams) {
		this.p = p;
	}

	startSeason(prevRel: Map<number, number>): void {
		this.teams = new Map();
		this.prevRel = prevRel;
	}

	priorFor(team: number, mean: number, day: number): { mu: number; nu: number; prec: number } {
		const p = this.p;
		const state = this.teams.get(team);
		if (!state) {
			const prev = this.prevRel.get(team);
			if (prev === undefined)
				return { mu: (mean / 2) * p.rhoNew, nu: (mean / 2) * p.rhoNewScore, prec: p.lamNew };
			const b = p.beta * (prev - 1);
			return {
				mu: (mean / 2) * (p.rhoPrev + b),
				nu: (mean / 2) * (p.rhoPrevScore + b),
				prec: p.lamPrev
			};
		}
		const weeks = Math.max(0, day - state.day) / 7;
		const carried = (x: number) => {
			const rel = state.meanRef > 0 ? x / (state.meanRef / 2) : 1;
			const scale = state.meanRef > 0 && mean > 0 ? (mean / state.meanRef) ** p.drift : 1;
			return (1 + p.carry * (rel - 1)) * (state.meanRef / 2) * scale;
		};
		return {
			mu: carried(state.mu),
			nu: carried(state.nu),
			prec: 1 / (1 / state.prec + p.q + p.qWeek * weeks)
		};
	}

	startEvent(teams: number[], mean: number, day: number): void {
		const n = teams.length;
		this.n = n;
		this.index = new Map(teams.map((t, i) => [t, i]));
		this.mu = new Float64Array(n);
		this.nu = new Float64Array(n);
		this.prior = new Float64Array(n);
		this.priorNu = new Float64Array(n);
		this.P = new Float64Array(n * n);
		this.played = new Int32Array(n);
		this.ph = new Float64Array(n);
		teams.forEach((t, i) => {
			const pr = this.priorFor(t, mean, day);
			this.mu[i] = this.prior[i] = pr.mu;
			this.nu[i] = this.priorNu[i] = pr.nu;
			this.P[i * n + i] = 1 / pr.prec;
		});
	}

	refresh(team: number, mean: number, day: number): void {
		const i = this.index.get(team)!;
		if (this.played[i] > 0) return;
		const pr = this.priorFor(team, mean, day);
		this.mu[i] += pr.mu - this.prior[i];
		this.nu[i] += pr.nu - this.priorNu[i];
		this.prior[i] = pr.mu;
		this.priorNu[i] = pr.nu;
	}

	at(team: number): number {
		return this.index.get(team)!;
	}

	variance(idx: number[], w: number[]): number {
		const n = this.n;
		let v = 0;
		for (let a = 0; a < idx.length; a++) {
			const row = idx[a] * n;
			for (let b = 0; b < idx.length; b++) v += w[a] * w[b] * this.P[row + idx[b]];
		}
		return v;
	}

	bump(idx: number[], q: number): void {
		if (q <= 0) return;
		for (const i of idx) this.P[i * this.n + i] += q;
	}

	observe(idx: number[], h: number[], y: number, r = 1): void {
		const n = this.n;
		const P = this.P;
		const ph = this.ph;
		ph.fill(0);
		for (let a = 0; a < idx.length; a++) {
			const row = idx[a] * n;
			const w = h[a];
			if (w === 0) continue;
			for (let k = 0; k < n; k++) ph[k] += w * P[row + k];
		}
		let hph = 0;
		let pred = 0;
		let predNu = 0;
		for (let a = 0; a < idx.length; a++) {
			hph += h[a] * ph[idx[a]];
			pred += h[a] * this.mu[idx[a]];
			predNu += h[a] * this.nu[idx[a]];
		}
		const s = hph + r;
		const resid = y - pred;
		const residNu = y - predNu;
		for (let k = 0; k < n; k++) {
			const g = ph[k] / s;
			this.mu[k] += g * resid;
			this.nu[k] += g * residNu;
		}
		for (let a = 0; a < n; a++) {
			const fa = ph[a] / s;
			if (fa === 0) continue;
			const row = a * n;
			for (let b = 0; b < n; b++) P[row + b] -= fa * ph[b];
		}
	}

	endEvent(mean: number, day: number): void {
		const n = this.n;
		for (const [team, i] of this.index) {
			if (this.played[i] === 0) continue;
			this.teams.set(team, {
				mu: this.mu[i],
				nu: this.nu[i],
				prec: 1 / Math.max(this.P[i * n + i], 1e-9),
				meanRef: mean,
				day
			});
		}
	}

	endSeason(): Map<number, number> {
		return new Map(
			[...this.teams].map(([t, s]) => [t, s.meanRef > 0 ? s.mu / (s.meanRef / 2) : 1])
		);
	}
}
