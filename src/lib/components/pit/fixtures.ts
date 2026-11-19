import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectPhase } from '#lib/game/phase.ts';
import {
	mapAdvancement,
	mapAlliances,
	mapAwards,
	mapEvent,
	mapMatches,
	mapRankings,
	mapTeams
} from '#lib/server/ftc/mappers.ts';
import type { EventBundle } from '#lib/types.ts';

const ROOT = join(process.cwd(), 'tests/fixtures/ftc/2026/');

function read<T>(code: string, name: string): T {
	return JSON.parse(readFileSync(`${ROOT}${code}/${name}.json`, 'utf8')) as T;
}

export function fixtureBundle(code: string, now = Date.parse('2026-11-19T12:00:00Z')): EventBundle {
	const event = mapEvent(
		read<{ events: Parameters<typeof mapEvent>[0][] }>(code, 'event').events[0]
	);
	const matches = mapMatches({
		timezone: event.timezone,
		qualSchedule: read(code, 'schedule-qual'),
		playoffSchedule: read(code, 'schedule-playoff'),
		qualScores: read(code, 'scores-qual'),
		playoffScores: read(code, 'scores-playoff')
	});
	const alliances = mapAlliances(read(code, 'alliances'));
	const awards = mapAwards(read(code, 'awards'));
	return {
		event,
		teams: mapTeams([read(code, 'teams')]),
		matches,
		rankings: mapRankings(read(code, 'rankings')),
		alliances,
		awards,
		advancement: mapAdvancement(read(code, 'advancement')),
		phase: detectPhase({ event, matches, alliances, awards, now, endsAt: null }),
		fetchedAt: now,
		stale: false,
		source: 'ftc'
	};
}
