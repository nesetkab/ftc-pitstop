export function erfc(x: number): number {
	const z = Math.abs(x);
	const t = 1 / (1 + 0.5 * z);
	const r =
		t *
		Math.exp(
			-z * z -
				1.26551223 +
				t *
					(1.00002368 +
						t *
							(0.37409196 +
								t *
									(0.09678418 +
										t *
											(-0.18628806 +
												t *
													(0.27886807 +
														t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
		);
	return x >= 0 ? r : 2 - r;
}

export function normalCdf(x: number): number {
	return 0.5 * erfc(-x / Math.SQRT2);
}

export function normalQuantile(p: number): number {
	const q = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
	const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
	const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
	const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
	const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
	const low = 0.02425;
	if (q < low) {
		const t = Math.sqrt(-2 * Math.log(q));
		return (((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) / ((((d[0] * t + d[1]) * t + d[2]) * t + d[3]) * t + 1);
	}
	if (q > 1 - low) return -normalQuantile(1 - q);
	const t = q - 0.5;
	const r = t * t;
	return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * t) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function clamp(x: number, lo: number, hi: number): number {
	return x < lo ? lo : x > hi ? hi : x;
}

export function poissonPmf(k: number, lambda: number): number {
	if (k < 0) return 0;
	if (lambda <= 0) return k === 0 ? 1 : 0;
	let logP = -lambda + k * Math.log(lambda);
	for (let i = 2; i <= k; i++) logP -= Math.log(i);
	return Math.exp(logP);
}

export function poissonAtLeast(k: number, lambda: number): number {
	if (k <= 0) return 1;
	if (lambda <= 0) return 0;
	let term = Math.exp(-lambda);
	let below = term;
	for (let i = 1; i < k; i++) {
		term *= lambda / i;
		below += term;
	}
	return clamp(1 - below, 0, 1);
}

export function negBinAtLeast(k: number, mean: number, size: number): number {
	if (!Number.isFinite(size) || size <= 0) return poissonAtLeast(k, mean);
	if (k <= 0) return 1;
	if (mean <= 0) return 0;
	const p = size / (size + mean);
	let term = p ** size;
	let below = term;
	for (let i = 1; i < k; i++) {
		term *= ((i - 1 + size) / i) * (1 - p);
		below += term;
	}
	return clamp(1 - below, 0, 1);
}

export function countPmf(mean: number, size: number, max: number): Float64Array {
	const out = new Float64Array(max + 1);
	if (mean <= 0) {
		out[0] = 1;
		return out;
	}
	let total = 0;
	if (!Number.isFinite(size) || size <= 0) {
		let term = Math.exp(-mean);
		for (let i = 0; i <= max; i++) {
			if (i > 0) term *= mean / i;
			out[i] = term;
			total += term;
		}
	} else {
		const p = size / (size + mean);
		let term = p ** size;
		for (let i = 0; i <= max; i++) {
			if (i > 0) term *= ((i - 1 + size) / i) * (1 - p);
			out[i] = term;
			total += term;
		}
	}
	out[max] += Math.max(0, 1 - total);
	return out;
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function normalSampler(rng: Rng): () => number {
	let spare = 0;
	let hasSpare = false;
	return () => {
		if (hasSpare) {
			hasSpare = false;
			return spare;
		}
		let u = 0;
		let v = 0;
		let s = 0;
		do {
			u = rng() * 2 - 1;
			v = rng() * 2 - 1;
			s = u * u + v * v;
		} while (s >= 1 || s === 0);
		const f = Math.sqrt((-2 * Math.log(s)) / s);
		spare = v * f;
		hasSpare = true;
		return u * f;
	};
}
