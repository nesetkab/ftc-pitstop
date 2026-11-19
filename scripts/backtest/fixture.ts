import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ModelEvent, ModelMatch } from '../../src/lib/model/types.ts';
import { loadSeason, type HistMatch, type HistTeam } from './hist.ts';
import { detailOf } from './production.ts';

const CODE = process.argv[2] ?? 'USAZGIQ';
const STATS = process.argv[3];
const OUT = join(import.meta.dirname, '..', '..', 'tests', 'fixtures', 'model', `${CODE}.json`);

const ms = (value: string | null) => (value ? Date.parse(value) : null);

function onField(teams: HistTeam[]): HistTeam[] {
	return teams.filter((t) => t.s).sort((a, b) => (a.s ?? 0) - (b.s ?? 0));
}

function convert(code: string, m: HistMatch): ModelMatch {
	const red = onField(m.red);
	const blue = onField(m.blue);
	const qual = m.level === 'Quals';
	const all = [...red, ...blue];
	return {
		key: qual ? `q${m.num}` : m.num > 1 ? `p${m.series}-${m.num}` : `p${m.series || m.num}`,
		eventCode: code,
		level: qual ? 'qual' : 'playoff',
		series: m.series,
		number: m.num,
		time: ms(m.actual) ?? ms(m.sched) ?? 0,
		scheduledTime: ms(m.sched),
		actualTime: ms(m.actual),
		red: red.map((t) => t.n),
		blue: blue.map((t) => t.n),
		redScore: m.played && m.rs ? m.rs.totalPoints : null,
		blueScore: m.played && m.bs ? m.bs.totalPoints : null,
		redNp: m.played && m.rs ? m.rs.totalPointsNp : null,
		blueNp: m.played && m.bs ? m.bs.totalPointsNp : null,
		redDetail: m.rs
			? detailOf(
					m.rs,
					red.map((t) => t.s!)
				)
			: undefined,
		blueDetail: m.bs
			? detailOf(
					m.bs,
					blue.map((t) => t.s!)
				)
			: undefined,
		surrogates: all.filter((t) => t.sur).map((t) => t.n),
		noShows: all.filter((t) => t.ns).map((t) => t.n),
		dqs: all.filter((t) => t.dq).map((t) => t.n)
	};
}

async function main(): Promise<void> {
	const season = await loadSeason(2026);
	const e = season.events.find((x) => x.code === CODE);
	if (!e) throw new Error(`no event ${CODE}`);
	const event: ModelEvent = {
		code: e.code,
		start: e.start,
		end: e.end,
		official: true,
		matches: e.matches.map((m) => convert(e.code, m))
	};
	type Stat = {
		teamNumber: number;
		stats: { rank: number; rp: number; tb1: number; tb2: number; qualMatchesPlayed: number };
	};
	const stats: Stat[] = STATS ? JSON.parse(await readFile(STATS, 'utf8')).teams : [];
	const rankings = stats
		.filter((t) => t.stats)
		.map((t) => ({
			team: t.teamNumber,
			rank: t.stats.rank,
			rs: t.stats.rp,
			tbp: t.stats.tb1,
			tips: t.stats.tb2,
			played: t.stats.qualMatchesPlayed
		}))
		.sort((a, b) => a.rank - b.rank);
	const byKey = new Map(event.matches.map((m) => [m.key, m]));
	const seeds = [
		byKey.get('p3')!.red,
		byKey.get('p4')!.red,
		byKey.get('p2')!.red,
		byKey.get('p1')!.red,
		byKey.get('p1')!.blue,
		byKey.get('p2')!.blue
	];
	await mkdir(join(OUT, '..'), { recursive: true });
	await writeFile(
		OUT,
		`${JSON.stringify({ source: `FTCScout GraphQL, season 2026, event ${CODE}, fetched ${season.fetchedAt.slice(0, 10)}`, event, rankings, alliances: seeds }, null, '\t')}\n`
	);
	console.log(`wrote ${OUT}: ${event.matches.length} matches, ${rankings.length} ranked teams`);
}

await main();
