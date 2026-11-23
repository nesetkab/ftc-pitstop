const REFERENCE_MS = 6;

const SAMPLE = JSON.stringify(
	Array.from({ length: 2_000 }, (_, index) => ({ index, name: `team ${index}`, opr: index / 7 }))
);

function calibrate(): number {
	const started = performance.now();
	for (let round = 0; round < 20; round++) JSON.parse(SAMPLE);
	return performance.now() - started;
}

export function slowdown(): number {
	const runs = [calibrate(), calibrate(), calibrate()].sort((a, b) => a - b);
	return Math.max(1, runs[1] / REFERENCE_MS);
}

export function ceiling(ms: number): number {
	return ms * slowdown();
}
