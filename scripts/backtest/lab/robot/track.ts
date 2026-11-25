export class Tracker {
	keys: string[];
	base: Record<string, number>;
	global: Record<string, number> = {};
	pending: Record<string, number> = {};
	snap: Record<string, number> = {};
	local: Record<string, number> = {};
	day: number | null = null;
	prior: Record<string, number>;

	constructor(keys: string[], prior: Record<string, number>) {
		this.keys = [...keys, 'w'];
		this.base = prior;
		this.prior = { ...prior };
		for (const k of this.keys) this.global[k] = this.pending[k] = this.snap[k] = this.local[k] = 0;
	}

	startSeason(): void {
		const w = this.global.w + this.pending.w;
		if (w > 0) {
			for (const k of this.keys) {
				if (k === 'w') continue;
				this.prior[k] = (this.global[k] + this.pending[k]) / w;
			}
		}
		for (const k of this.keys) this.global[k] = this.pending[k] = this.snap[k] = this.local[k] = 0;
		this.day = null;
	}

	startEvent(day: number): void {
		if (this.day !== day) {
			for (const k of this.keys) {
				this.global[k] += this.pending[k];
				this.pending[k] = 0;
			}
			this.snap = { ...this.global };
			this.day = day;
		}
		for (const k of this.keys) this.local[k] = 0;
	}

	add(values: Record<string, number>): void {
		this.local.w += 1;
		for (const [k, v] of Object.entries(values)) this.local[k] += v;
	}

	endEvent(): void {
		for (const k of this.keys) this.pending[k] += this.local[k];
		for (const k of this.keys) this.local[k] = 0;
	}

	mean(k: string, w0 = 20): number {
		const w = this.snap.w + this.local.w;
		return (this.snap[k] + this.local[k] + w0 * this.prior[k]) / (w + w0);
	}
}
