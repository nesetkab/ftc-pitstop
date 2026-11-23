import { eventStatus } from '#lib/components/event/dates.ts';
import { listed, type ListedEvent } from '#lib/components/event/event-list.ts';
import { finishedEvents, loadSeasonEvents } from '#lib/server/event.ts';
import { loadStrengthWithin } from '#lib/server/strength.ts';
import type { EventSummary } from '#lib/types.ts';
import { loadTeamCounts, teamCount } from './team-counts.server.ts';

export interface EventList {
	summaries: EventSummary[];
	events: ListedEvent[];
	finished: string[];
	fetchedAt: number;
	stale: boolean;
	now: number;
}

export async function loadEventList(): Promise<EventList | null> {
	const [list, counts, strength] = await Promise.all([
		loadSeasonEvents().catch(() => null),
		loadTeamCounts(),
		loadStrengthWithin()
	]);
	if (!list) return null;
	const now = Date.now();
	const live = new Set(
		list.events.filter((event) => eventStatus(event, now) === 'live').map((event) => event.code)
	);
	return {
		summaries: list.events,
		events: list.events.map((event) =>
			listed(
				event,
				teamCount(event, counts?.[event.code], now),
				strength?.events.get(event.code)?.top ?? null
			)
		),
		finished: finishedEvents().filter((code) => live.has(code)),
		fetchedAt: list.fetchedAt,
		stale: list.stale,
		now
	};
}
