import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PEvent, PMatch } from '../../prep.ts';
import type { RobotRaw, RobotSeason } from './download.ts';

const ROBOT_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '.cache', 'robot');

export type Side = {
	auto: number;
	ra: number[];
	re: number[];
	mv: number[];
};

export type RMatch = PMatch & { red2?: Side | null; blue2?: Side | null };

type Robot = { ra: number; re: number; mv: number };

const NAV_2021: Record<string, number> = {
	InStorage: 3,
	CompletelyInStorage: 6,
	InWarehouse: 5,
	CompletelyInWarehouse: 10
};
const PARK_2021: Record<string, number> = { InWarehouse: 3, CompletelyInWarehouse: 6 };
const NAV_2022: Record<string, number> = { Terminal: 2, Signal: 10, TeamSignal: 20 };
const PROP_2023: Record<string, number> = { NoProp: 10, TeamProp: 20 };
const EG_2023: Record<string, number> = { Backstage: 5, Rigging: 20 };
const DRONE_2023: Record<number, number> = { 1: 30, 2: 20, 3: 10 };
const AUTO_PARK_2024: Record<string, number> = { ObservationZone: 3, Ascent1: 3, Ascent2: 3, Ascent3: 3 };
const DC_PARK_2024: Record<string, number> = { ObservationZone: 3, Ascent1: 3, Ascent2: 15, Ascent3: 30 };

const num = (x: unknown) => (typeof x === 'number' ? x : x === true ? 1 : 0);
const pick = (table: Record<string | number, number>, x: unknown) =>
	table[x as string | number] ?? 0;

export function robotOf(season: number, s: RobotRaw, k: 1 | 2): Robot {
	switch (season) {
		case 2021: {
			const nav = pick(NAV_2021, s[`autoNav2021_${k}`]);
			const bonus = s[`autoBonus${k}`] ? (s[`barcodeElement${k}`] === 'TSE' ? 20 : 10) : 0;
			return { ra: nav + bonus, re: pick(PARK_2021, s[`egPark${k}`]), mv: nav > 0 ? 1 : 0 };
		}
		case 2022: {
			const nav = pick(NAV_2022, s[`autoNav2022_${k}`]);
			return { ra: nav, re: s[`egNav${k}`] ? 2 : 0, mv: nav > 0 ? 1 : 0 };
		}
		case 2023: {
			const nav = s[`autoNav${k}`] ? 5 : 0;
			const ra = nav + pick(PROP_2023, s[`purple${k}`]) + pick(PROP_2023, s[`yellow${k}`]);
			const re = pick(EG_2023, s[`egNav2023_${k}`]) + pick(DRONE_2023, num(s[`drone${k}`]));
			return { ra, re, mv: nav > 0 ? 1 : 0 };
		}
		case 2024: {
			const ra = pick(AUTO_PARK_2024, s[`autoPark${k}`]);
			return { ra, re: pick(DC_PARK_2024, s[`dcPark${k}`]), mv: ra > 0 ? 1 : 0 };
		}
		case 2025: {
			const leave = num(s[`autoLeave${k}`]);
			return { ra: leave, re: num(s[`dcBase${k}`]), mv: leave > 0 ? 1 : 0 };
		}
		default: {
			const leave = num(s[`autoLeave${k}`]);
			const leavePts = num(s.autoLeavePoints);
			const total = num(s.autoLeave1) + num(s.autoLeave2);
			const ra = (total > 0 ? (leavePts * leave) / total : 0) + num(s[`autoParkPoints${k}`]);
			return { ra, re: num(s[`dcParkPoints${k}`]), mv: leave > 0 ? 1 : 0 };
		}
	}
}

export function allianceCheck(season: number, s: RobotRaw): [number, number] {
	const a = robotOf(season, s, 1);
	const b = robotOf(season, s, 2);
	const mine = a.ra + b.ra + a.re + b.re;
	const keys: Record<number, string[]> = {
		2021: ['autoNavPoints', 'autoBonusPoints', 'egParkPoints'],
		2022: ['autoNavPoints', 'egNavPoints'],
		2023: ['autoNavPoints', 'purplePoints', 'yellowPoints', 'egNavPoints', 'dronePoints'],
		2024: ['autoParkPoints', 'dcParkPoints'],
		2025: ['autoLeavePoints', 'dcBasePoints'],
		2026: ['autoLeavePoints', 'autoParkPoints', 'dcParkPoints']
	};
	const theirs = keys[season].reduce((t, k) => t + num(s[k]), 0) - (season === 2025 ? num(s.dcBaseBonus) : 0);
	return [mine, theirs];
}

function side(season: number, m: PMatch, raw: RobotRaw, red: boolean): Side | null {
	const teams = red ? m.red : m.blue;
	const st = red ? m.redSt : m.blueSt;
	const s = red ? m.rs : m.bs;
	if (s.autoPoints === undefined) return null;
	const out: Side = { auto: s.autoPoints, ra: [], re: [], mv: [] };
	const used = new Set<number>();
	for (let i = 0; i < teams.length; i++) {
		const k = st[i] === 2 ? 2 : 1;
		if (used.has(k)) return null;
		used.add(k);
		const r = robotOf(season, raw, k);
		out.ra.push(r.ra);
		out.re.push(r.re);
		out.mv.push(r.mv);
	}
	const total = out.ra.reduce((a, b) => a + b, 0) + out.re.reduce((a, b) => a + b, 0);
	const autoR = out.ra.reduce((a, b) => a + b, 0);
	if (total > (red ? m.redNp : m.blueNp) || autoR > out.auto) return null;
	return out;
}

const loaded = new Set<PEvent[]>();

export function attach(seasons: PEvent[][]): void {
	for (const events of seasons) {
		if (!events.length || loaded.has(events)) continue;
		loaded.add(events);
		const season = events[0].season;
		const path = join(ROBOT_ROOT, `${season}.json`);
		const data: RobotSeason | null =
			season < 2026 && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
		for (const e of events) {
			for (const m of e.matches as RMatch[]) {
				const raw = season >= 2026 ? [m.rs, m.bs] : data?.[`${e.code}:${m.id}`];
				m.red2 = raw ? side(season, m, raw[0], true) : null;
				m.blue2 = raw ? side(season, m, raw[1], false) : null;
			}
		}
	}
}
