import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type HistTeam = { n: number; s?: 1 | 2; sur?: 1; ns?: 1; dq?: 1; off?: 1 };

export type HistMatch = {
	id: number;
	level: string;
	series: number;
	num: number;
	played: boolean;
	sched: string | null;
	actual: string | null;
	post: string | null;
	red: HistTeam[];
	blue: HistTeam[];
	rs: Record<string, number> | null;
	bs: Record<string, number> | null;
};

export type HistEvent = {
	season: number;
	code: string;
	name: string;
	type: string;
	start: string;
	end: string;
	timezone: string;
	region: string | null;
	division: string | null;
	league: string | null;
	finished: boolean;
	matches: HistMatch[];
};

export type HistSeason = { season: number; fetchedAt: string; fields: string[]; events: HistEvent[] };

export const HIST_ROOT = join(import.meta.dirname, '..', '..', '.cache', 'hist');

export const OFFICIAL_TYPES = new Set([
	'LeagueMeet',
	'Qualifier',
	'LeagueTournament',
	'Championship',
	'FIRSTChampionship',
	'SuperQualifier',
	'Premier'
]);

export async function loadSeason(season: number): Promise<HistSeason> {
	return JSON.parse(await readFile(join(HIST_ROOT, `${season}.json`), 'utf8')) as HistSeason;
}
