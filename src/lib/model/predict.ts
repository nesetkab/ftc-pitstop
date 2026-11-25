import type { Component, Forecast } from './opr.ts';
import { SCORE_SIGMA } from './opr.ts';
import {
	calibratedSwarm,
	calibratedTips,
	expectedRp,
	RP_RULES,
	type RpChances,
	type RpRules,
	type TipModel,
	TIP_MODEL
} from './rp.ts';
import { clamp, normalCdf } from './stats.ts';

export type WinParams = {
	link: 'probit' | 'logit';
	kappa: number;
	eta: number;
	gamma: number;
	tie: number;
};

export const WIN_PARAMS: WinParams = {
	link: 'logit',
	kappa: 0.35378,
	eta: 0,
	gamma: 0.5,
	tie: 0.025
};

export type AlliancePrediction = {
	score: number;
	np: number;
	sd: number;
	components: Record<Component, number>;
	rp: RpChances & { expected: number };
};

export type MatchPrediction = {
	red: AlliancePrediction;
	blue: AlliancePrediction;
	redWin: number;
	blueWin: number;
	tie: number;
	margin: number;
	marginSd: number;
};

export type PredictOptions = {
	win?: WinParams;
	rules?: RpRules;
	tips?: TipModel;
	swarm?: { red: number; blue: number };
	sigma?: number;
};

export function marginScale(forecast: Forecast, win: WinParams = WIN_PARAMS): number {
	const { red, blue, stats } = forecast;
	let scale =
		win.kappa * stats.sd * Math.sqrt(forecast.marginVariance / 2 + win.eta * forecast.uncertainty);
	if (win.gamma !== 0 && stats.mean > 0) {
		const level = clamp((red.strength + blue.strength) / (2 * stats.mean), 0.25, 4);
		scale *= level ** win.gamma;
	}
	return Math.max(scale, 1e-9);
}

export function redChance(forecast: Forecast, win: WinParams = WIN_PARAMS): number {
	const z = (forecast.red.strength - forecast.blue.strength) / marginScale(forecast, win);
	return win.link === 'probit' ? normalCdf(z) : 1 / (1 + Math.exp(-z));
}

export function outcomeChances(
	forecast: Forecast,
	win: WinParams = WIN_PARAMS
): { red: number; blue: number; tie: number } {
	const p = redChance(forecast, win);
	const z = (forecast.red.strength - forecast.blue.strength) / marginScale(forecast, win);
	const tie = Math.min(win.tie * Math.exp(-0.5 * z * z), 2 * Math.min(p, 1 - p));
	return { red: clamp(p - tie / 2, 0, 1), blue: clamp(1 - p - tie / 2, 0, 1), tie };
}

export function predictMatch(forecast: Forecast, options: PredictOptions = {}): MatchPrediction {
	const win = options.win ?? WIN_PARAMS;
	const rules = options.rules ?? RP_RULES;
	const tips = options.tips ?? TIP_MODEL;
	const sigma = (options.sigma ?? SCORE_SIGMA) * forecast.stats.sd;
	const odds = outcomeChances(forecast, win);
	const side = (own: 'red' | 'blue'): AlliancePrediction => {
		const f = forecast[own];
		const other = forecast[own === 'red' ? 'blue' : 'red'];
		const fouls = Math.max(other.components.fouls, 0);
		const t = calibratedTips(f.components.tips, rules, tips);
		const chances: RpChances = {
			win: own === 'red' ? odds.red : odds.blue,
			tie: odds.tie,
			swarm: options.swarm
				? calibratedSwarm(options.swarm[own], f.components.leave + f.components.park)
				: 0,
			pollinator1: t.pollinator1,
			pollinator2: t.pollinator2
		};
		return {
			score: f.score + (Number.isFinite(fouls) ? fouls : 0),
			np: f.score,
			sd: sigma * Math.sqrt(f.variance),
			components: f.components,
			rp: { ...chances, expected: expectedRp(chances, rules) }
		};
	};
	return {
		red: side('red'),
		blue: side('blue'),
		redWin: odds.red,
		blueWin: odds.blue,
		tie: odds.tie,
		margin: forecast.red.score - forecast.blue.score,
		marginSd: sigma * Math.sqrt(forecast.marginVariance)
	};
}
