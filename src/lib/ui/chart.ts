export function linearScale(
	[domainStart, domainEnd]: [number, number],
	[rangeStart, rangeEnd]: [number, number]
): (value: number) => number {
	const span = domainEnd - domainStart;
	return (value) =>
		span === 0
			? (rangeStart + rangeEnd) / 2
			: rangeStart + ((value - domainStart) / span) * (rangeEnd - rangeStart);
}

export function niceStep(span: number, count: number): number {
	const raw = span / Math.max(1, count);
	const power = 10 ** Math.floor(Math.log10(raw));
	const fraction = raw / power;
	const nice =
		fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
	return nice * power;
}

export function niceTicks(min: number, max: number, count = 4): number[] {
	if (!(max > min)) return [min, min + 1];
	const step = niceStep(max - min, count);
	const first = Math.floor(min / step);
	const last = Math.ceil(max / step);
	const ticks: number[] = [];
	for (let index = first; index <= last; index++) {
		ticks.push(Number((index * step).toFixed(10)));
	}
	return ticks;
}

export function labelEvery(count: number, spacing: number, minimum = 34): number {
	if (count <= 1 || spacing >= minimum) return 1;
	return Math.ceil(minimum / Math.max(spacing, 1));
}
