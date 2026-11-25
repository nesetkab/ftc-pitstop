import {
	blendPrevious,
	rateSeason,
	type Forecast,
	type PriorRel,
	type RobotBase
} from '../../src/lib/model/opr.ts';
import type { AllianceDetail, ModelEvent, ModelMatch } from '../../src/lib/model/types.ts';
import { STRIDE, type Records } from './engine.ts';
import { loadSeason } from './hist.ts';
import { attach, type RMatch, type Side } from './lab/robot/data.ts';
import { prepSeason, type PEvent, type PMatch } from './prep.ts';

export const FIRST_BASE: RobotBase = { np: 100, robot: 20 };

export function detailOf(
	s: Record<string, number>,
	stations: (1 | 2)[]
): AllianceDetail | undefined {
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
		robotSwarm: stations.map(
			(k) => s[`autoLeave${k}`] + s[`autoParkPoints${k}`] + s[`dcParkPoints${k}`]
		)
	};
}

function withRobots(
	detail: AllianceDetail | undefined,
	side: Side | null | undefined
): AllianceDetail | undefined {
	if (side === undefined) return detail;
	if (side === null) return detail && { ...detail, robotSwarm: undefined };
	return { ...detail, robotSwarm: side.ra.map((a, k) => a + side.re[k]) };
}

export function toModelMatch(code: string, m: PMatch, position: number): ModelMatch {
	const r = m as RMatch;
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
		redDetail: withRobots(detailOf(m.rs, m.redSt), r.red2),
		blueDetail: withRobots(detailOf(m.bs, m.blueSt), r.blue2),
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

export type History = {
	seasons: Map<number, PriorRel>[];
	base: RobotBase;
};

export function productionForecasts(seasons: PEvent[][]): Map<string, Forecast> {
	attach(seasons);
	const out = new Map<string, Forecast>();
	let history: History = { seasons: [], base: FIRST_BASE };
	for (const events of seasons) {
		const season = events[0]?.season;
		history = rateHistory(history, events.map(toModelEvent), (match, forecast) =>
			out.set(`${season}:${match.key}`, forecast)
		);
	}
	return out;
}

function rateHistory(
	history: History,
	events: ModelEvent[],
	onForecast?: (match: ModelMatch, forecast: Forecast) => void
): History {
	const result = rateSeason(events, {
		previous: blendPrevious(history.seasons),
		base: history.base,
		onForecast: onForecast && ((_event, match, forecast) => onForecast(match, forecast))
	});
	return { seasons: [result.relative, ...history.seasons], base: result.base };
}

export function productionRecords(rec: Records, seasons: PEvent[][], name: string): Records {
	const forecasts = productionForecasts(seasons);
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

export async function historyFor(season: number, first = 2021): Promise<History> {
	let history: History = { seasons: [], base: FIRST_BASE };
	for (let s = first; s < season; s++) {
		const events = prepSeason(await loadSeason(s));
		attach([events]);
		history = rateHistory(history, events.map(toModelEvent));
	}
	return history;
}

export async function previousFor(
	season: number,
	first = 2021
): Promise<{ previous: Map<number, PriorRel>; base: RobotBase }> {
	const history = await historyFor(season, first);
	return { previous: blendPrevious(history.seasons), base: history.base };
}
