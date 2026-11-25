import { niceStep } from '#lib/ui/chart.ts';

export interface Spread {
	start: number;
	step: number;
	counts: number[];
}

export const SPREAD_MIN_TEAMS = 10;

const BINS = 32;

export function oprSpread(values: number[], bins = BINS): Spread | null {
	const finite = values.filter(Number.isFinite);
	if (finite.length < SPREAD_MIN_TEAMS) return null;
	let low = Number.POSITIVE_INFINITY;
	let high = Number.NEGATIVE_INFINITY;
	for (const value of finite) {
		if (value < low) low = value;
		if (value > high) high = value;
	}
	const step = niceStep(Math.max(high - low, 1), bins);
	const start = Math.floor(low / step) * step;
	const size = Math.max(1, Math.floor((high - start) / step) + 1);
	const counts = Array.from({ length: size }, () => 0);
	for (const value of finite) {
		const index = Math.min(size - 1, Math.max(0, Math.floor((value - start) / step)));
		counts[index] += 1;
	}
	return { start: Number(start.toFixed(10)), step, counts };
}

export function spreadBin(spread: Spread, value: number): number {
	const index = Math.floor((value - spread.start) / spread.step);
	return Math.min(spread.counts.length - 1, Math.max(0, index));
}
