import type { Ctx, Model } from './models.ts';
import type { PEvent } from './prep.ts';

export type Records = {
	n: number;
	models: string[];
	season: Int16Array;
	playoff: Uint8Array;
	early: Uint8Array;
	official: Uint8Array;
	outcome: Float64Array;
	sd: Float64Array;
	mean: Float64Array;
	unc: Float64Array;
	redNp: Float64Array;
	blueNp: Float64Array;
	pred: Float64Array;
	keys: string[];
};

export type EngineOptions = { halfLife: number; warmup: number };

export const STRIDE = 5;

type Sums = { w: number; s: number; ss: number };

function stats(a: Sums, b: Sums, day: number): Ctx {
	const w = a.w + b.w;
	if (w <= 0) return { mean: 0, sd: 1, day };
	const mean = (a.s + b.s) / w;
	const variance = Math.max((a.ss + b.ss) / w - mean * mean, 1e-6);
	return { mean, sd: Math.sqrt(variance), day };
}

export function run(seasons: PEvent[][], models: Model[], opts: EngineOptions): Records {
	const total = seasons.reduce((n, s) => n + s.reduce((k, e) => k + e.matches.length, 0), 0);
	const M = models.length;
	const rec: Records = {
		n: 0,
		models: models.map((m) => m.name),
		season: new Int16Array(total),
		playoff: new Uint8Array(total),
		early: new Uint8Array(total),
		official: new Uint8Array(total),
		outcome: new Float64Array(total),
		sd: new Float64Array(total),
		mean: new Float64Array(total),
		unc: new Float64Array(total),
		redNp: new Float64Array(total),
		blueNp: new Float64Array(total),
		pred: new Float64Array(total * M * STRIDE),
		keys: []
	};
	const prevRel = models.map(() => new Map<number, number>());
	for (const events of seasons) {
		models.forEach((m, i) => m.startSeason(prevRel[i]));
		const global: Sums = { w: 0, s: 0, ss: 0 };
		let globalDay: number | null = null;
		let seen = 0;
		let i = 0;
		while (i < events.length) {
			const day = events[i].day;
			if (globalDay !== null && Number.isFinite(opts.halfLife)) {
				const f = 0.5 ** ((day - globalDay) / opts.halfLife);
				global.w *= f;
				global.s *= f;
				global.ss *= f;
			}
			globalDay = day;
			const snapshot: Sums = { ...global };
			const added: Sums = { w: 0, s: 0, ss: 0 };
			while (i < events.length && events[i].day === day) {
				const event = events[i++];
				const local: Sums = { w: 0, s: 0, ss: 0 };
				const played = new Map<number, number>();
				models.forEach((m) => m.startEvent(event, stats(snapshot, local, day)));
				for (const match of event.matches) {
					const ctx = stats(snapshot, local, day);
					const preds = models.map((m) => m.predict(match, ctx));
					if (seen >= opts.warmup) {
						const r = rec.n++;
						rec.season[r] = event.season;
						rec.playoff[r] = match.playoff ? 1 : 0;
						rec.official[r] = event.official ? 1 : 0;
						const counts = [...match.red, ...match.blue].map((t) => played.get(t) ?? 0);
						rec.early[r] = Math.min(...counts) < 2 ? 1 : 0;
						rec.unc[r] = counts.reduce((u, c) => u + 1 / (1 + c), 0);
						rec.mean[r] = ctx.mean;
						rec.outcome[r] =
							match.redTotal > match.blueTotal ? 1 : match.redTotal < match.blueTotal ? 0 : 0.5;
						rec.sd[r] = ctx.sd;
						rec.redNp[r] = match.redNp;
						rec.blueNp[r] = match.blueNp;
						rec.keys.push(`${event.season}:${match.key}`);
						for (let k = 0; k < M; k++) {
							const o = (r * M + k) * STRIDE;
							rec.pred[o] = preds[k].red;
							rec.pred[o + 1] = preds[k].blue;
							rec.pred[o + 2] = preds[k].varFactor;
							rec.pred[o + 3] = preds[k].redScore;
							rec.pred[o + 4] = preds[k].blueScore;
						}
					}
					models.forEach((m) => m.update(match, ctx));
					for (const [ok, y] of [
						[match.redOk, match.redNp],
						[match.blueOk, match.blueNp]
					] as const) {
						if (!ok) continue;
						local.w += 1;
						local.s += y;
						local.ss += y * y;
					}
					for (const t of [...match.redUpd, ...match.blueUpd])
						played.set(t, (played.get(t) ?? 0) + 1);
					seen++;
				}
				models.forEach((m) => m.endEvent(event, stats(snapshot, local, day)));
				added.w += local.w;
				added.s += local.s;
				added.ss += local.ss;
			}
			global.w += added.w;
			global.s += added.s;
			global.ss += added.ss;
		}
		models.forEach((m, k) => (prevRel[k] = m.endSeason()));
	}
	return rec;
}
