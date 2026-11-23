import { unpackEvents, type ListedEvent, type PackedEvents } from './event-list.ts';

export const SEASON_EVENTS_URL = '/events/season.json';

export function createSeasonEvents(fetcher: typeof fetch = (...args) => fetch(...args)) {
	let request: Promise<ListedEvent[]> | null = null;

	async function fetchAll(): Promise<ListedEvent[]> {
		const response = await fetcher(SEASON_EVENTS_URL);
		if (!response.ok) throw new Error(`Event list returned ${response.status}`);
		return unpackEvents((await response.json()) as PackedEvents);
	}

	function load(): Promise<ListedEvent[]> {
		request ??= fetchAll().catch((error: unknown) => {
			request = null;
			throw error;
		});
		return request;
	}

	return { load };
}

export const seasonEvents = createSeasonEvents();
