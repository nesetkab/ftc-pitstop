import { POOLED_BASE, PooledOpr, type PooledParams } from './model.ts';

export const VARIANTS: Record<string, Partial<PooledParams>> = {
	pooled: {},
	'pooled-diag': { block: false },
	'pooled-hl30': { halfLife: 30 },
	'pooled-hl60': { halfLife: 60 },
	'pooled-q': { q: 0.15, qWeek: 0.01 }
};

export function make(name: string, extra: Partial<PooledParams> = {}): PooledOpr {
	const v = VARIANTS[name];
	if (!v) throw new Error(`unknown variant ${name}`);
	return new PooledOpr(name, { ...POOLED_BASE, ...v, ...extra });
}
