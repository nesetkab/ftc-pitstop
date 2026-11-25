import { Blend, type Model } from '../../models.ts';
import { POOLED_BASE, PooledOpr } from '../pooled/model.ts';
import { IMB } from '../pooled/variants.ts';
import { FinalOpr, ROBOT_HET, type FitFloor, type Head } from './heads.ts';

export type Spec = { imbFit: number; head: Head; fitFloor?: FitFloor; pooled?: number };

export const FLOOR: FitFloor = { floor: 0, width: 0.25 };

export const SPECS: Record<string, Spec> = {
	'imb+predfloor': { imbFit: 0.1, head: { imb: 0.2, floor: 0.1, width: 0.16 } },
	final: { imbFit: 0.1, head: { imb: 0.2, ...FLOOR, floorScore: true }, fitFloor: FLOOR },
	'final+pool': {
		imbFit: 0.1,
		head: { imb: 0.2, ...FLOOR, floorScore: true },
		fitFloor: FLOOR,
		pooled: 0.35
	}
};

export function build(name: string, s: Spec = SPECS[name]): Model {
	const robot = new FinalOpr(name, ROBOT_HET, s.imbFit, s.head, s.fitFloor);
	if (!s.pooled) return robot;
	return new Blend(name, robot, new PooledOpr('pooled', { ...POOLED_BASE, ...IMB }), 1 - s.pooled);
}
