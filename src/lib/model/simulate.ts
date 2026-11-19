import { RP_RULES, type RpRules } from './rp.ts';
import { mulberry32, normalQuantile, normalSampler } from './stats.ts';
import type { ModelMatch } from './types.ts';

export type Tally = {
	team: number;
	rp: number;
	np: number;
	tips: number;
	auto: number;
	counted: number;
};

export type SimMatch = {
	red: number[];
	blue: number[];
	surrogates?: number[];
	redWin: number;
	blueWin: number;
	tie: number;
	redScore: number;
	blueScore: number;
	redSd: number;
	blueSd: number;
	redTips: number;
	blueTips: number;
	redPollinator1: number;
	redPollinator2: number;
	bluePollinator1: number;
	bluePollinator2: number;
	redSwarm: number;
	blueSwarm: number;
	redAuto: number;
	blueAuto: number;
};

export type SimInput = {
	teams: number[];
	current: Tally[];
	remaining: SimMatch[];
	rules?: RpRules;
};

export type SimOptions = { sims?: number; seed?: number };

export type RankProjection = {
	team: number;
	rankChances: number[];
	top4: number;
	top8: number;
	expectedRs: number;
	expectedRank: number;
};

export function tallyResults(matches: ModelMatch[], rules: RpRules = RP_RULES): Tally[] {
	const out = new Map<number, Tally>();
	const row = (team: number) => {
		let t = out.get(team);
		if (!t) {
			t = { team, rp: 0, np: 0, tips: 0, auto: 0, counted: 0 };
			out.set(team, t);
		}
		return t;
	};
	for (const m of matches) {
		if (m.level !== 'qual' || m.redScore === null || m.blueScore === null) continue;
		const surrogates = new Set(m.surrogates ?? []);
		const dqs = new Set(m.dqs ?? []);
		for (const own of ['red', 'blue'] as const) {
			const teams = m[own];
			const score = own === 'red' ? m.redScore : m.blueScore;
			const other = own === 'red' ? m.blueScore : m.redScore;
			const np = (own === 'red' ? m.redNp : m.blueNp) ?? score;
			const detail = own === 'red' ? m.redDetail : m.blueDetail;
			const tips = detail?.tips ?? 0;
			const swarm = (detail?.leavePoints ?? 0) + (detail?.parkPoints ?? 0) >= rules.swarm ? 1 : 0;
			const rp =
				(score > other ? rules.win : score === other ? rules.tie : 0) +
				swarm +
				(tips >= rules.pollinator1 ? 1 : 0) +
				(tips >= rules.pollinator2 ? 1 : 0);
			for (const team of teams) {
				if (surrogates.has(team)) continue;
				const t = row(team);
				t.rp += dqs.has(team) ? 0 : rp;
				t.np += np;
				t.tips += tips;
				t.auto += detail?.autoPoints ?? 0;
				t.counted += 1;
			}
		}
	}
	return [...out.values()];
}

export function simulateRankings(input: SimInput, options: SimOptions = {}): RankProjection[] {
	const sims = options.sims ?? 10000;
	const rng = mulberry32(options.seed ?? 1);
	const normal = normalSampler(rng);
	const rules = input.rules ?? RP_RULES;
	const teams = input.teams;
	const n = teams.length;
	const index = new Map(teams.map((t, i) => [t, i]));
	const baseRp = new Float64Array(n);
	const baseNp = new Float64Array(n);
	const baseTips = new Float64Array(n);
	const baseAuto = new Float64Array(n);
	const baseCount = new Float64Array(n);
	for (const t of input.current) {
		const i = index.get(t.team);
		if (i === undefined) continue;
		baseRp[i] = t.rp;
		baseNp[i] = t.np;
		baseTips[i] = t.tips;
		baseAuto[i] = t.auto;
		baseCount[i] = t.counted;
	}
	const M = input.remaining.length;
	const plan = input.remaining.map((m) => {
		const surrogates = new Set(m.surrogates ?? []);
		const counted = (ts: number[]) =>
			Int32Array.from(
				ts.filter((t) => !surrogates.has(t) && index.has(t)).map((t) => index.get(t)!)
			);
		const decided = Math.max(m.redWin + m.blueWin, 1e-9);
		const pRed = m.redWin / decided;
		const spread = Math.sqrt(m.redSd ** 2 + m.blueSd ** 2);
		const mid = (m.redScore + m.blueScore) / 2;
		const shift = (normalQuantile(pRed) * spread) / 2;
		return {
			red: counted(m.red),
			blue: counted(m.blue),
			tie: m.tie,
			redMean: mid + shift,
			blueMean: mid - shift,
			redSd: m.redSd,
			blueSd: m.blueSd,
			redTips: m.redTips,
			blueTips: m.blueTips,
			redP1: m.redPollinator1,
			redP2: Math.min(m.redPollinator2, m.redPollinator1),
			blueP1: m.bluePollinator1,
			blueP2: Math.min(m.bluePollinator2, m.bluePollinator1),
			redSwarm: m.redSwarm,
			blueSwarm: m.blueSwarm,
			redAuto: m.redAuto,
			blueAuto: m.blueAuto
		};
	});
	const rp = new Float64Array(n);
	const np = new Float64Array(n);
	const tips = new Float64Array(n);
	const auto = new Float64Array(n);
	const count = new Float64Array(n);
	const rs = new Float64Array(n);
	const tbp = new Float64Array(n);
	const avgTips = new Float64Array(n);
	const avgAuto = new Float64Array(n);
	const coin = new Float64Array(n);
	const order = Array.from({ length: n }, (_, i) => i);
	const rankCounts = new Float64Array(n * n);
	const rsSum = new Float64Array(n);
	const compare = (a: number, b: number) =>
		rs[b] - rs[a] ||
		tbp[b] - tbp[a] ||
		avgTips[b] - avgTips[a] ||
		avgAuto[b] - avgAuto[a] ||
		coin[b] - coin[a];
	for (let s = 0; s < sims; s++) {
		rp.set(baseRp);
		np.set(baseNp);
		tips.set(baseTips);
		auto.set(baseAuto);
		count.set(baseCount);
		for (let k = 0; k < M; k++) {
			const m = plan[k];
			const redNp = Math.max(0, m.redMean + m.redSd * normal());
			const blueNp = Math.max(0, m.blueMean + m.blueSd * normal());
			const isTie = rng() < m.tie;
			const redWins = !isTie && redNp > blueNp;
			const blueWins = !isTie && !redWins;
			const ru = rng();
			const bu = rng();
			const redTips = m.redTips;
			const blueTips = m.blueTips;
			const redRp =
				(redWins ? rules.win : isTie ? rules.tie : 0) +
				(rng() < m.redSwarm ? 1 : 0) +
				(ru < m.redP1 ? 1 : 0) +
				(ru < m.redP2 ? 1 : 0);
			const blueRp =
				(blueWins ? rules.win : isTie ? rules.tie : 0) +
				(rng() < m.blueSwarm ? 1 : 0) +
				(bu < m.blueP1 ? 1 : 0) +
				(bu < m.blueP2 ? 1 : 0);
			for (let j = 0; j < m.red.length; j++) {
				const i = m.red[j];
				rp[i] += redRp;
				np[i] += redNp;
				tips[i] += redTips;
				auto[i] += m.redAuto;
				count[i] += 1;
			}
			for (let j = 0; j < m.blue.length; j++) {
				const i = m.blue[j];
				rp[i] += blueRp;
				np[i] += blueNp;
				tips[i] += blueTips;
				auto[i] += m.blueAuto;
				count[i] += 1;
			}
		}
		for (let i = 0; i < n; i++) {
			const c = count[i] || 1;
			rs[i] = rp[i] / c;
			tbp[i] = np[i] / c;
			avgTips[i] = tips[i] / c;
			avgAuto[i] = auto[i] / c;
			coin[i] = rng();
			rsSum[i] += rs[i];
		}
		order.sort(compare);
		for (let r = 0; r < n; r++) rankCounts[order[r] * n + r]++;
	}
	return teams.map((team, i) => {
		const chances = Array.from(rankCounts.subarray(i * n, (i + 1) * n), (c) => c / sims);
		let top4 = 0;
		let top8 = 0;
		let expectedRank = 0;
		chances.forEach((p, r) => {
			if (r < 4) top4 += p;
			if (r < 8) top8 += p;
			expectedRank += p * (r + 1);
		});
		return { team, rankChances: chances, top4, top8, expectedRs: rsSum[i] / sims, expectedRank };
	});
}
