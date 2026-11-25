import type { Model } from '../../models.ts';
import type { CompParams } from './comp.ts';
import { RobotOpr, type RoprOpts } from './ropr.ts';
import { BASE } from './setup.ts';

type Variant = { start: Record<string, unknown>; make: (p: any, name: string) => Model };

const direct: CompParams = { ...BASE };

export const VARIANTS: Record<string, Variant> = {
	total: {
		start: { rest: BASE, hist: [0, 0] },
		make: (p: RoprOpts, name) => new RobotOpr(name, p)
	},
	robot: {
		start: { rest: BASE, robot: direct, rVar: 0, hist: [0, 0] },
		make: (p: RoprOpts, name) => new RobotOpr(name, p)
	},
	gate: {
		start: { rest: BASE, robot: direct, auto: BASE, move: direct, gate: 0.5, rVar: 0, hist: [0, 0] },
		make: (p: RoprOpts, name) => new RobotOpr(name, p)
	}
};
