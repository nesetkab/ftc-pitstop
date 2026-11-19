import { rateSeason, type Forecast, type OprParams as ProdParams } from '../../src/lib/model/opr.ts';
import type { AllianceDetail, ModelEvent, ModelMatch } from '../../src/lib/model/types.ts';
import { STRIDE, type Records } from './engine.ts';
import type { OprParams } from './models.ts';
import type { PEvent, PMatch } from './prep.ts';

export function toProdParams(p: OprParams): ProdParams {
	return {
		lamNew: p.lamNew,
		lamReturning: p.lamPrevSeason,
		rhoNew: p.rhoNew,
		rhoReturning: p.rhoPrev,
		rhoNewScore: p.rhoNewScore ?? p.rhoNew,
		rhoReturningScore: p.rhoPrevScore ?? p.rhoPrev,
		beta: p.beta,
		q: p.q,
		qWeek: p.qWeek,
		carry: p.carry,
		drift: p.drift
	};
}

export function detailOf(s: Record<string, number>, stations: (1 | 2)[]): AllianceDetail | undefined {
	if (s.tips === undefined) return undefined;
	return {
		autoPoints: s.autoPoints,
		teleopPoints: s.dcPoints,
		hivePoints: s.autoHivePoints + s.dcHivePoints,
		tips: s.tips,
		leavePoints: s.autoLeavePoints,
		parkPoints: s.autoParkPoints + s.dcParkPoints,
		gardenPoints: s.dcGardenPoints,
		flowerPoints: s.dcFlowerPoints,
		fouls: s.penaltyPointsCommitted,
		robotSwarm: stations.map((k) => s[`autoLeave${k}`] + s[`autoParkPoints${k}`] + s[`dcParkPoints${k}`])
	};
}

export function toModelMatch(code: string, m: PMatch, position: number): ModelMatch {
	const noShows = [
		...m.red.filter((t) => !m.redUpd.includes(t)),
		...m.blue.filter((t) => !m.blueUpd.includes(t))
	];
	return {
		key: m.key,
		eventCode: code,
		level: m.playoff ? 'playoff' : 'qual',
		number: position,
		time: position,
		scheduledTime: m.sched,
		actualTime: m.actual,
		red: m.red,
		blue: m.blue,
		redScore: m.redTotal,
		blueScore: m.blueTotal,
		redNp: m.redNp,
		blueNp: m.blueNp,
		redDetail: detailOf(m.rs, m.redSt),
		blueDetail: detailOf(m.bs, m.blueSt),
		surrogates: [...m.redSur, ...m.blueSur],
		noShows,
		dqs: m.dq
	};
}

export function toModelEvent(e: PEvent): ModelEvent {
	return {
		code: e.code,
		start: e.start,
		end: e.end,
		official: e.official,
		matches: e.matches.map((m, i) => toModelMatch(e.code, m, i))
	};
}

export function productionForecasts(seasons: PEvent[][], params: OprParams): Map<string, Forecast> {
	const out = new Map<string, Forecast>();
	let previous = new Map<number, number>();
	for (const events of seasons) {
		const season = events[0]?.season;
		const result = rateSeason(events.map(toModelEvent), {
			previous,
			params: toProdParams(params),
			onForecast: (_event, match, forecast) => out.set(`${season}:${match.key}`, forecast)
		});
		previous = result.relative;
	}
	return out;
}

export function productionRecords(rec: Records, seasons: PEvent[][], params: OprParams, name: string): Records {
	const forecasts = productionForecasts(seasons, params);
	const pred = new Float64Array(rec.n * STRIDE);
	for (let r = 0; r < rec.n; r++) {
		const f = forecasts.get(rec.keys[r]);
		if (!f) throw new Error(`missing production forecast for ${rec.keys[r]}`);
		const o = r * STRIDE;
		pred[o] = f.red.strength;
		pred[o + 1] = f.blue.strength;
		pred[o + 2] = f.marginVariance / 2;
		pred[o + 3] = f.red.score;
		pred[o + 4] = f.blue.score;
	}
	return { ...rec, models: [name], pred };
}
