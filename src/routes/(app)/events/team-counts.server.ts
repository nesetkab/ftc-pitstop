import type { Rosters } from '#lib/components/event/strength.ts';
import { localDate } from '#lib/format/calendar.ts';
import { settleWithin } from '#lib/server/cache.ts';
import { loadRosters } from '#lib/server/rosters.ts';
import type { EventSummary } from '#lib/types.ts';

const WAIT_MS = 3_000;

export interface TeamCount {
	registered: number;
	played: number;
}

export type TeamCounts = Record<string, TeamCount>;

export function countTeams(rosters: Rosters): TeamCounts {
	const counts: TeamCounts = {};
	for (const [code, roster] of Object.entries(rosters)) {
		counts[code] = { registered: roster.registered.length, played: roster.played.length };
	}
	return counts;
}

export function teamCount(
	event: Pick<EventSummary, 'end' | 'timezone'>,
	count: TeamCount | undefined,
	now: number
): number | null {
	if (!count) return null;
	const over = event.end < localDate(now, event.timezone);
	return (over && count.played > 0 ? count.played : count.registered) || null;
}

const counted = new WeakMap<Rosters, TeamCounts>();

function countsOf(rosters: Rosters): TeamCounts {
	let counts = counted.get(rosters);
	if (!counts) {
		counts = countTeams(rosters);
		counted.set(rosters, counts);
	}
	return counts;
}

export function loadTeamCounts(
	load: () => Promise<Rosters> = loadRosters,
	ms = WAIT_MS
): Promise<TeamCounts | null> {
	return settleWithin(load().then(countsOf), ms);
}
