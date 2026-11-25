import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Blend, KalmanOpr, type Model, type OprParams } from '../../models.ts';
import { PooledPriorOpr } from './hybrid.ts';
import { POOLED_BASE, PooledOpr, type PooledParams } from './model.ts';

export type Extra = Partial<PooledParams> & { mix?: number; w?: number };

const SHIPPED = (
	JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'params.json'), 'utf8')) as {
		candidates: Record<string, OprParams>;
	}
).candidates['opr-map'];

export const TUNED: Partial<PooledParams> = {
	halfLife: 75,
	q: 0.3,
	kappa: 0.5,
	rhoNew: 0.15,
	rhoPrev: 0.5,
	beta: 0.6,
	drift: 0.5
};

const pooled = (name: string, p: Partial<PooledParams>) => (x: Extra) =>
	new PooledOpr(name, { ...POOLED_BASE, ...p, ...x });

export const VARIANTS: Record<string, (x: Extra) => Model> = {
	pooled: pooled('pooled', {}),
	'pooled-tuned': pooled('pooled-tuned', TUNED),
	'pooled-nodecay': pooled('pooled-nodecay', { ...TUNED, halfLife: Infinity }),
	'pooled-noprev': pooled('pooled-noprev', { ...TUNED, beta: 0 }),
	'pooled-total': pooled('pooled-total', { ...TUNED, target: 'total' }),
	'pooled-huber': pooled('pooled-huber', { ...TUNED, huber: 2 }),
	'pooled-pen': pooled('pooled-pen', { ...TUNED, penW: 0.5 }),
	'pooled-off': pooled('pooled-off', { ...TUNED, offW: 0.5 }),
	hybrid: (x) =>
		new PooledPriorOpr(
			'hybrid',
			SHIPPED,
			new PooledOpr('inner', { ...POOLED_BASE, ...TUNED, ...x }),
			x.mix ?? 1
		),
	blend: (x) =>
		new Blend(
			'blend',
			new KalmanOpr('a', SHIPPED),
			new PooledOpr('b', { ...POOLED_BASE, ...TUNED, ...x }),
			x.w ?? 0.5
		)
};

export function make(name: string, extra: Extra = {}): Model {
	const v = VARIANTS[name];
	if (!v) throw new Error(`unknown variant ${name}`);
	const model = v(extra);
	model.name = name;
	return model;
}
