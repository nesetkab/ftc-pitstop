import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventSummary } from '#lib/components/team/fixtures.ts';
import type { EventSummary } from '#lib/types.ts';
import { load } from './+page.server.ts';

const server = vi.hoisted(() => ({
	loadEventsToday: vi.fn(),
	loadSeasonEvents: vi.fn()
}));

vi.mock('#lib/server/event.ts', () => server);
vi.mock('#lib/server/records.ts', () => ({ loadRecentRecords: vi.fn(async () => null) }));

type Home = {
	today: { code: string }[] | null;
	week: { code: string }[] | null;
};

function call() {
	const setHeaders = vi.fn();
	const result = load({ setHeaders } as never) as Promise<Home>;
	return { result, setHeaders };
}

function inDays(days: number): string {
	return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

const today: EventSummary[] = [
	eventSummary({ code: 'NOW', start: inDays(0), end: inDays(0), timezone: 'UTC' })
];
const season: EventSummary[] = [
	...today,
	eventSummary({ code: 'SOON', start: inDays(3), end: inDays(3), timezone: 'UTC' }),
	eventSummary({ code: 'FAR', start: inDays(30), end: inDays(30), timezone: 'UTC' })
];

beforeEach(() => {
	for (const mock of Object.values(server)) mock.mockReset();
});

describe('home load', () => {
	it('lists events today and events starting this week', async () => {
		server.loadEventsToday.mockResolvedValue(today);
		server.loadSeasonEvents.mockResolvedValue({ events: season, fetchedAt: 1, stale: false });
		const { result, setHeaders } = call();
		const data = await result;
		expect(data.today?.map((event) => event.code)).toEqual(['NOW']);
		expect(data.week?.map((event) => event.code)).toEqual(['SOON']);
		expect(setHeaders).toHaveBeenCalledWith({
			'cache-control': 'public, s-maxage=30, stale-while-revalidate=300'
		});
	});

	it('keeps the other list when one cannot be loaded', async () => {
		server.loadEventsToday.mockRejectedValue(new Error('down'));
		server.loadSeasonEvents.mockResolvedValue({ events: season, fetchedAt: 1, stale: false });
		const data = await call().result;
		expect(data.today).toBeNull();
		expect(data.week).toHaveLength(1);
	});

	it('still renders when neither list can be loaded', async () => {
		server.loadEventsToday.mockRejectedValue(new Error('down'));
		server.loadSeasonEvents.mockRejectedValue(new Error('down'));
		expect(await call().result).toEqual({ today: null, week: null });
	});
});
