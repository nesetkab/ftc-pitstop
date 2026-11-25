import type { Model } from '../../models.ts';
import type { CompParams } from './comp.ts';
import { RobotEpa, type EpaComp, type RepaOpts } from './repa.ts';
import { RobotOpr, type RoprOpts } from './ropr.ts';
import { BASE } from './setup.ts';

type Variant = { start: Record<string, unknown>; make: (p: any, name: string) => Model };

const direct: CompParams = { ...BASE };

export const EPA: EpaComp = {
	k0: 0.45,
	kMin: 0.075,
	tau: 8,
	reset: 0.375,
	wk: 0,
	carry: 0.9,
	drift: 0.25,
	beta: 0.4,
	rhoNew: 0.3,
	rhoPrev: 0.5,
	rhoNewScore: 0.6,
	rhoPrevScore: 0.7
};

const opr = (p: RoprOpts, name: string) => new RobotOpr(name, p);
const epa = (p: RepaOpts, name: string) => new RobotEpa(name, p);
const epaRobot = { ...EPA, k0: 0.3, kMin: 0.1 };

export const VARIANTS: Record<string, Variant> = {
	total: { start: { rest: BASE, hist: [0, 0] }, make: opr },
	robot: { start: { rest: BASE, robot: direct, rVar: 0, hist: [0, 0] }, make: opr },
	het: { start: { rest: BASE, robot: direct, rVar: 0, het: 0, hist: [0, 0] }, make: opr },
	auto: { start: { rest: BASE, robot: direct, auto: BASE, rVar: 0, hist: [0, 0] }, make: opr },
	gate: {
		start: { rest: BASE, robot: direct, auto: BASE, move: direct, gate: 0.5, rVar: 0, hist: [0, 0] },
		make: opr
	},
	'epa-total': { start: { rest: EPA, margin: 0, clip: 4, unc: 0, hist: [0, 0] }, make: epa },
	'epa-robot': {
		start: { rest: EPA, robot: epaRobot, margin: 0, clip: 4, unc: 0, hist: [0, 0] },
		make: epa
	},
	'epa-gate': {
		start: {
			rest: EPA,
			robot: epaRobot,
			auto: EPA,
			move: epaRobot,
			gate: 0.3,
			margin: 0,
			clip: 4,
			unc: 0,
			hist: [0, 0]
		},
		make: epa
	}
};
