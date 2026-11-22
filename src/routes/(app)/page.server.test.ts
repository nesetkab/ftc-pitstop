import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventSummary } from '#lib/components/team/fixtures.ts';
import type { EventSummary } from '#lib/types.ts';
import { load } from './+page.server.ts';

const server = vi.hoisted(() => ({
	loadEventsToday: vi.fn(),
	loadSeasonEvents: vi.fn()
}));

const home = vi.hoisted(() => ({
	loadTodayProgress: vi.fn(),
	loadHighlights: vi.fn()
}));

vi.mock('#lib/server/event.ts', () => server);
vi.mock('#lib/server/home.ts', () => home);
vi.mock('#lib/server/records.ts', () => ({
	recordNames: vi.fn(async () => ({ teams: { 1: 'One' }, events: { NOW: 'Now Event' } }))
}));

type Home = {
	today: { code: string; status: string; state: string }[] | null;
	week: { code: string }[] | null;
	highlights: unknown;
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
	home.loadTodayProgress.mockReset().mockResolvedValue({});
	home.loadHighlights.mockReset().mockResolvedValue(null);
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
		expect(await call().result).toEqual({ today: null, week: null, highlights: null });
		expect(home.loadTodayProgress).not.toHaveBeenCalled();
	});

	it('adds live progress for competitions running today', async () => {
		server.loadEventsToday.mockResolvedValue(today);
		server.loadSeasonEvents.mockResolvedValue({ events: season, fetchedAt: 1, stale: false });
		home.loadTodayProgress.mockResolvedValue({
			NOW: { phase: 'quals', label: 'Q23 of 40', leader: { team: 1, name: 'One' } }
		});
		const data = await call().result;
		expect(home.loadTodayProgress).toHaveBeenCalledWith(today);
		expect(data.today?.[0]).toMatchObject({ code: 'NOW', status: 'Q23 of 40', state: 'live' });
	});

	it('keeps the event list when progress cannot be read', async () => {
		server.loadEventsToday.mockResolvedValue(today);
		server.loadSeasonEvents.mockResolvedValue({ events: season, fetchedAt: 1, stale: false });
		home.loadTodayProgress.mockRejectedValue(new Error('down'));
		const data = await call().result;
		expect(data.today?.[0].code).toBe('NOW');
	});

	it('names the teams and events in the highlights', async () => {
		server.loadEventsToday.mockResolvedValue([]);
		server.loadSeasonEvents.mockResolvedValue({ events: [], fetchedAt: 1, stale: false });
		const item = {
			event: 'NOW',
			key: 'q1',
			label: 'Q1',
			red: [1, 2],
			blue: [3, 4],
			redScore: 100,
			blueScore: 90,
			winner: 'red',
			chance: null
		};
		home.loadHighlights.mockResolvedValue({
			range: 'week',
			highest: [item],
			closest: [],
			upsets: []
		});
		const data = await call().result;
		expect(data.highlights).toMatchObject({
			range: 'week',
			names: { teams: { 1: 'One' }, events: { NOW: 'Now Event' } }
		});
	});
});
