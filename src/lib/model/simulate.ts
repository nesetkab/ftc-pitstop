import { RP_RULES, type RpRules } from './rp.ts';
import { countPmf, mulberry32, normalQuantile, normalSampler } from './stats.ts';
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
	tipSize?: number;
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

const MAX_TIPS = 24;

type TipBins = { p1: number; p2: number; low: number; mid: number; high: number };

function tipBins(mean: number, size: number, rules: RpRules): TipBins {
	const pmf = countPmf(Math.max(mean, 0), size, MAX_TIPS);
	let low = 0;
	let lowW = 0;
	let mid = 0;
	let midW = 0;
	let high = 0;
	let highW = 0;
	for (let k = 0; k <= MAX_TIPS; k++) {
		if (k < rules.pollinator1) {
			low += k * pmf[k];
			lowW += pmf[k];
		} else if (k < rules.pollinator2) {
			mid += k * pmf[k];
			midW += pmf[k];
		} else {
			high += k * pmf[k];
			highW += pmf[k];
		}
	}
	return {
		p1: midW + highW,
		p2: highW,
		low: lowW > 0 ? low / lowW : 0,
		mid: midW > 0 ? mid / midW : rules.pollinator1,
		high: highW > 0 ? high / highW : rules.pollinator2
	};
}

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
	const tipSize = input.tipSize ?? Infinity;
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
			redTips: tipBins(m.redTips, tipSize, rules),
			blueTips: tipBins(m.blueTips, tipSize, rules),
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
			const rt = m.redTips;
			const bt = m.blueTips;
			const redTips = ru < rt.p2 ? rt.high : ru < rt.p1 ? rt.mid : rt.low;
			const blueTips = bu < bt.p2 ? bt.high : bu < bt.p1 ? bt.mid : bt.low;
			const redRp =
				(redWins ? rules.win : isTie ? rules.tie : 0) +
				(rng() < m.redSwarm ? 1 : 0) +
				(ru < rt.p1 ? 1 : 0) +
				(ru < rt.p2 ? 1 : 0);
			const blueRp =
				(blueWins ? rules.win : isTie ? rules.tie : 0) +
				(rng() < m.blueSwarm ? 1 : 0) +
				(bu < bt.p1 ? 1 : 0) +
				(bu < bt.p2 ? 1 : 0);
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
