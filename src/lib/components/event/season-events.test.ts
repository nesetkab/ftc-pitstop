import { describe, expect, it, vi } from 'vitest';
import type { EventSummary } from '#lib/types.ts';
import { listed, packEvents } from './event-list.ts';
import { createSeasonEvents, SEASON_EVENTS_URL } from './season-events.ts';

const event: EventSummary = {
	code: 'USAZGIQ',
	name: 'Gilbert Qualifier',
	type: 'Qualifier',
	typeName: 'Qualifier',
	region: 'USAZ',
	league: null,
	venue: null,
	city: 'Gilbert',
	state: 'AZ',
	country: 'USA',
	timezone: 'America/Phoenix',
	start: '2026-11-28',
	end: '2026-11-29',
	hasMatches: null
};

const events = [listed(event, 24, 51.2)];

describe('season event list', () => {
	it('fetches the full list once and unpacks it', async () => {
		const fetcher = vi.fn(async () => Response.json(packEvents(events)));
		const season = createSeasonEvents(fetcher);
		const [first, second] = await Promise.all([season.load(), season.load()]);
		expect(first).toEqual(events);
		expect(second).toBe(first);
		expect(await season.load()).toBe(first);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher).toHaveBeenCalledWith(SEASON_EVENTS_URL);
	});

	it('tries again after a failed request', async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(Response.json({ error: 'down' }, { status: 503 }))
			.mockResolvedValueOnce(Response.json(packEvents(events)));
		const season = createSeasonEvents(fetcher);
		await expect(season.load()).rejects.toThrow('503');
		expect(await season.load()).toEqual(events);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
