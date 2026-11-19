import { allianceDetail, playingTeams } from '#lib/analysis/convert.ts';
import type { AnalysisContext } from '#lib/analysis/types.ts';
import { createCache } from '#lib/server/cache.ts';
import { createLoaders } from '#lib/server/event.ts';
import { createFtcClient } from '#lib/server/ftc/client.ts';
import { createFtcScoutClient } from '#lib/server/ftcscout.ts';
import { createNexusClient } from '#lib/server/nexus.ts';
import type { EventBundle, Match, SeasonMatch, SeasonMatchAlliance } from '#lib/types.ts';
import recorded from '../fixtures/analysis/contexts.json';
import { fixtureFetch } from '../data/helpers.ts';

export const contexts = recorded.contexts as unknown as Record<string, AnalysisContext>;

export function fixtureLoaders(now = '2026-11-19T12:00:00Z') {
	const time = Date.parse(now);
	return createLoaders({
		ftc: createFtcClient({
			username: 'tester',
			apiKey: 'not-a-real-key',
			fetch: fixtureFetch().fetch,
			sleep: async () => {}
		}),
		scout: createFtcScoutClient({
			fetch: (async () => new Response('offline', { status: 500 })) as typeof fetch,
			sleep: async () => {}
		}),
		nexus: createNexusClient({ apiKey: undefined }),
		cache: createCache({ onError: () => {}, now: () => time }),
		now: () => time
	});
}

export async function bundleFor(code: string, now?: string): Promise<EventBundle> {
	const { cacheControl, ...bundle } = await fixtureLoaders(now).loadEventBundle(code);
	void cacheControl;
	return bundle;
}

function clear(match: Match): Match {
	return { ...match, result: null, actualTime: null, postedTime: null };
}

export function cutAfterQual(bundle: EventBundle, last: number): EventBundle {
	return {
		...bundle,
		matches: bundle.matches
			.filter((m) => m.level === 'qual')
			.map((m) => (m.number <= last ? m : clear(m))),
		rankings: [],
		alliances: [],
		awards: [],
		advancement: null,
		phase: 'quals'
	};
}

export function cutPlayoffs(bundle: EventBundle, keep: (match: Match) => boolean): EventBundle {
	return {
		...bundle,
		matches: bundle.matches.map((m) => (m.level === 'qual' || keep(m) ? m : clear(m))),
		awards: [],
		advancement: null,
		phase: 'playoffs'
	};
}

export function seasonMatchesOf(bundle: EventBundle, code: string, date: string): SeasonMatch[] {
	return bundle.matches.flatMap((m) => {
		const result = m.result;
		if (!result?.red.breakdown || !result.blue.breakdown) return [];
		const side = (color: 'red' | 'blue'): SeasonMatchAlliance => {
			const score = result[color];
			const other = result[color === 'red' ? 'blue' : 'red'];
			const points = score.breakdown!.points;
			const teams = playingTeams(m[color]);
			const flagged = (flag: 'surrogate' | 'noShow' | 'dq') =>
				teams.filter((t) => t[flag]).map((t) => t.team);
			return {
				teams: teams.map((t) => t.team),
				surrogates: flagged('surrogate'),
				noShows: flagged('noShow'),
				dqs: flagged('dq'),
				total: score.total,
				preFoulTotal: score.preFoulTotal,
				auto: score.auto,
				teleop: score.teleop,
				hive: points.teleopHive,
				flower: points.teleopFlower,
				garden: points.teleopGarden,
				park: points.teleopPark,
				foulPoints: score.foulPoints,
				tips: score.breakdown!.auto.tips + score.breakdown!.teleop.tips,
				leavePark: points.autoLeave + points.autoPark + points.teleopPark,
				robots: allianceDetail(score, other, teams).robotSwarm ?? [],
				rp: score.breakdown!.rp
			};
		};
		return [
			{
				eventCode: code,
				eventType: 'Qualifier',
				region: 'USAZ',
				date,
				end: date,
				time: m.actualTime,
				key: m.key,
				level: m.level,
				series: m.series,
				number: m.number,
				red: side('red'),
				blue: side('blue')
			}
		];
	});
}
