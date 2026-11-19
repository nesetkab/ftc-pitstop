import { clamp, negBinAtLeast, normalCdf } from './stats.ts';
import type { ModelMatch } from './types.ts';

export type RpRules = {
	swarm: number;
	pollinator1: number;
	pollinator2: number;
	win: number;
	tie: number;
};

export const RP_RULES: RpRules = { swarm: 16, pollinator1: 4, pollinator2: 7, win: 3, tie: 1 };

export type TipModel = { size: number };

export const TIP_MODEL: TipModel = { size: Infinity };

export const ROBOT_POINTS = [0, 3, 5, 8, 10, 13] as const;

export type SwarmModel = { prior: number; carry: number };

export const SWARM_MODEL: SwarmModel = { prior: 1.5, carry: 0.1 };

export type Platt = { a: number; b: number };

export const RP_CALIBRATION: { swarm: Platt; pollinator1: Platt; pollinator2: Platt } = {
	swarm: { a: 0.2496, b: 1.0491 },
	pollinator1: { a: 1.0793, b: 1.6114 },
	pollinator2: { a: 0.6465, b: 1.1286 }
};

export function recalibrate(p: number, c: Platt): number {
	const q = clamp(p, 1e-6, 1 - 1e-6);
	return 1 / (1 + Math.exp(-(c.a + c.b * Math.log(q / (1 - q)))));
}

export function calibratedTips(
	meanTips: number,
	rules: RpRules = RP_RULES,
	model: TipModel = TIP_MODEL,
	cal = RP_CALIBRATION
): { pollinator1: number; pollinator2: number } {
	const raw = tipChances(meanTips, rules, model);
	const pollinator1 = recalibrate(raw.pollinator1, cal.pollinator1);
	return {
		pollinator1,
		pollinator2: Math.min(recalibrate(raw.pollinator2, cal.pollinator2), pollinator1)
	};
}

export function calibratedSwarm(raw: number, cal = RP_CALIBRATION): number {
	return recalibrate(raw, cal.swarm);
}

export type RpChances = {
	win: number;
	tie: number;
	swarm: number;
	pollinator1: number;
	pollinator2: number;
};

export function tipChances(
	meanTips: number,
	rules: RpRules = RP_RULES,
	model: TipModel = TIP_MODEL
): { pollinator1: number; pollinator2: number } {
	const mean = Math.max(meanTips, 0.02);
	return {
		pollinator1: negBinAtLeast(rules.pollinator1, mean, model.size),
		pollinator2: negBinAtLeast(rules.pollinator2, mean, model.size)
	};
}

export function swarmFromRobots(robots: ArrayLike<number>[], rules: RpRules = RP_RULES): number {
	let dist = new Map<number, number>([[0, 1]]);
	for (const robot of robots) {
		const next = new Map<number, number>();
		for (const [total, p] of dist) {
			for (let k = 0; k < ROBOT_POINTS.length; k++) {
				const q = robot[k];
				if (!q) continue;
				const key = total + ROBOT_POINTS[k];
				next.set(key, (next.get(key) ?? 0) + p * q);
			}
		}
		dist = next;
	}
	let hit = 0;
	for (const [total, p] of dist) if (total >= rules.swarm) hit += p;
	return clamp(hit, 0, 1);
}

export function swarmFromMean(mean: number, sd: number, rules: RpRules = RP_RULES): number {
	return 1 - normalCdf((rules.swarm - 0.5 - mean) / Math.max(sd, 1e-6));
}

export function expectedRp(chances: RpChances, rules: RpRules = RP_RULES): number {
	return (
		rules.win * chances.win +
		rules.tie * chances.tie +
		chances.swarm +
		chances.pollinator1 +
		chances.pollinator2
	);
}

export function robotCategory(points: number): number {
	const k = ROBOT_POINTS.indexOf(points as (typeof ROBOT_POINTS)[number]);
	if (k >= 0) return k;
	let best = 0;
	for (let i = 1; i < ROBOT_POINTS.length; i++) {
		if (Math.abs(ROBOT_POINTS[i] - points) < Math.abs(ROBOT_POINTS[best] - points)) best = i;
	}
	return best;
}

export type SwarmState = {
	totals: number[];
	teams: Record<number, { counts: number[]; event: string }>;
};

export class SwarmBook {
	private counts = new Map<number, Float64Array>();
	private totals = new Float64Array(ROBOT_POINTS.length);
	private seen = new Map<number, string>();
	private model: SwarmModel;

	constructor(model: SwarmModel = SWARM_MODEL) {
		this.model = model;
	}

	static from(state: SwarmState, model: SwarmModel = SWARM_MODEL): SwarmBook {
		const book = new SwarmBook(model);
		book.totals = Float64Array.from(state.totals);
		for (const [team, entry] of Object.entries(state.teams)) {
			book.counts.set(Number(team), Float64Array.from(entry.counts));
			book.seen.set(Number(team), entry.event);
		}
		return book;
	}

	snapshot(teams: Iterable<number>): SwarmState {
		const out: SwarmState['teams'] = {};
		for (const team of teams) {
			const counts = this.counts.get(team);
			if (counts) out[team] = { counts: Array.from(counts), event: this.seen.get(team) ?? '' };
		}
		return { totals: Array.from(this.totals), teams: out };
	}

	private base(): Float64Array {
		const sum = this.totals.reduce((a, b) => a + b, 0);
		if (sum === 0) return Float64Array.from(ROBOT_POINTS, () => 1 / ROBOT_POINTS.length);
		return this.totals.map((t) => t / sum);
	}

	enterEvent(event: string, teams: number[]): void {
		for (const team of teams) this.touch(team, event);
	}

	private touch(team: number, event: string): Float64Array {
		let c = this.counts.get(team);
		if (!c) {
			c = new Float64Array(ROBOT_POINTS.length);
			this.counts.set(team, c);
		}
		const last = this.seen.get(team);
		if (last !== undefined && last !== event)
			for (let k = 0; k < c.length; k++) c[k] *= this.model.carry;
		this.seen.set(team, event);
		return c;
	}

	distribution(team: number): Float64Array {
		const base = this.base();
		const c = this.counts.get(team);
		const n = c ? c.reduce((a, b) => a + b, 0) : 0;
		const out = new Float64Array(ROBOT_POINTS.length);
		for (let k = 0; k < out.length; k++)
			out[k] = ((c?.[k] ?? 0) + this.model.prior * base[k]) / (n + this.model.prior);
		return out;
	}

	chance(teams: number[], rules: RpRules = RP_RULES): number {
		return swarmFromRobots(
			teams.map((t) => this.distribution(t)),
			rules
		);
	}

	update(m: ModelMatch): void {
		const absent = new Set(m.noShows ?? []);
		for (const [teams, detail] of [
			[m.red, m.redDetail],
			[m.blue, m.blueDetail]
		] as const) {
			const robots = detail?.robotSwarm;
			if (!robots) continue;
			teams.forEach((team, k) => {
				if (absent.has(team) || robots[k] === undefined) return;
				const cat = robotCategory(robots[k]);
				const c = this.touch(team, m.eventCode);
				c[cat] += 1;
				this.totals[cat] += 1;
			});
		}
	}
}
