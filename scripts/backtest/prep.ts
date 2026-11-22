import type { HistEvent, HistMatch, HistSeason, HistTeam } from './hist.ts';
import { OFFICIAL_TYPES } from './hist.ts';
import { plausibleScore } from '../../src/lib/model/types.ts';

export type PMatch = {
	key: string;
	id: number;
	playoff: boolean;
	red: number[];
	blue: number[];
	redUpd: number[];
	blueUpd: number[];
	redNp: number;
	blueNp: number;
	redTotal: number;
	blueTotal: number;
	redOk: boolean;
	blueOk: boolean;
	sched: number | null;
	actual: number | null;
	rs: Record<string, number>;
	bs: Record<string, number>;
	redSt: (1 | 2)[];
	blueSt: (1 | 2)[];
	redSur: number[];
	blueSur: number[];
	dq: number[];
};

export type PEvent = {
	season: number;
	code: string;
	type: string;
	official: boolean;
	start: string;
	end: string;
	day: number;
	matches: PMatch[];
};

const LEVEL_RANK: Record<string, number> = { Quals: 0, Semis: 1, Finals: 2, DoubleElim: 1 };

function playing(teams: HistTeam[]): HistTeam[] {
	const onStation = teams
		.filter((t) => t.s === 1 || t.s === 2)
		.sort((a, b) => (a.s ?? 0) - (b.s ?? 0));
	return onStation.length ? onStation : teams.filter((t) => !t.off).slice(0, 2);
}

function parseTime(value: string | null): number | null {
	if (!value) return null;
	const t = Date.parse(value);
	return Number.isFinite(t) ? t : null;
}

function plausible(s: Record<string, number>): boolean {
	const detailed = s.tips !== undefined;
	return plausibleScore(
		s.totalPoints ?? s.totalPointsNp,
		s.totalPointsNp,
		detailed ? s.autoPoints : undefined,
		detailed ? s.dcPoints : undefined
	);
}

function prepMatch(event: HistEvent, m: HistMatch): PMatch | null {
	if (!m.played || !m.rs || !m.bs) return null;
	if (!plausible(m.rs) || !plausible(m.bs)) return null;
	const red = playing(m.red);
	const blue = playing(m.blue);
	if (!red.length || !blue.length) return null;
	const redNp = m.rs.totalPointsNp;
	const blueNp = m.bs.totalPointsNp;
	if (!Number.isFinite(redNp) || !Number.isFinite(blueNp)) return null;
	const playoff = m.level !== 'Quals';
	const redDq = playoff && red.some((t) => t.dq);
	const blueDq = playoff && blue.some((t) => t.dq);
	const redUpd = red.filter((t) => !t.ns).map((t) => t.n);
	const blueUpd = blue.filter((t) => !t.ns).map((t) => t.n);
	return {
		key: `${event.code}:${m.id}`,
		id: m.id,
		playoff,
		red: red.map((t) => t.n),
		blue: blue.map((t) => t.n),
		redUpd,
		blueUpd,
		redNp,
		blueNp,
		redTotal: m.rs.totalPoints ?? redNp,
		blueTotal: m.bs.totalPoints ?? blueNp,
		redOk: !redDq && redUpd.length > 0,
		blueOk: !blueDq && blueUpd.length > 0,
		sched: parseTime(m.sched),
		actual: parseTime(m.actual),
		rs: m.rs,
		bs: m.bs,
		redSt: red.map((t) => t.s ?? 1),
		blueSt: blue.map((t) => t.s ?? 2),
		redSur: red.filter((t) => t.sur).map((t) => t.n),
		blueSur: blue.filter((t) => t.sur).map((t) => t.n),
		dq: [...red, ...blue].filter((t) => t.dq).map((t) => t.n)
	};
}

function orderMatches(matches: HistMatch[]): HistMatch[] {
	const quals = matches
		.filter((m) => m.level === 'Quals')
		.sort((a, b) => a.num - b.num || a.id - b.id);
	const playoffs = matches.filter((m) => m.level !== 'Quals');
	const timed = playoffs.every((m) => m.actual);
	playoffs.sort((a, b) => {
		if (timed) return Date.parse(a.actual!) - Date.parse(b.actual!) || a.id - b.id;
		const la = LEVEL_RANK[a.level] ?? 1;
		const lb = LEVEL_RANK[b.level] ?? 1;
		if (a.level === 'DoubleElim' && b.level === 'DoubleElim')
			return a.series - b.series || a.num - b.num;
		return la - lb || a.num - b.num || a.series - b.series;
	});
	return [...quals, ...playoffs];
}

function dayNumber(date: string): number {
	return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

export function prepSeason(data: HistSeason): PEvent[] {
	const events = data.events
		.map((e) => ({
			season: data.season,
			code: e.code,
			type: e.type,
			official: OFFICIAL_TYPES.has(e.type),
			start: e.start,
			end: e.end,
			day: dayNumber(e.start),
			matches: orderMatches(e.matches)
				.map((m) => prepMatch(e, m))
				.filter((m): m is PMatch => m !== null)
		}))
		.filter((e) => e.matches.length > 0);
	return events.sort(
		(a, b) =>
			a.start.localeCompare(b.start) ||
			a.end.localeCompare(b.end) ||
			b.matches.length - a.matches.length ||
			a.code.localeCompare(b.code)
	);
}
