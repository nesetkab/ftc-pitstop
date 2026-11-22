import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureBundle } from '#lib/components/event/test-fixtures.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { TeamSeason } from '#lib/types.ts';
import { GET } from './+server.ts';

const server = vi.hoisted(() => ({ loadEventBundle: vi.fn(), loadTeamSeason: vi.fn() }));

vi.mock('#lib/server/event.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/server/event.ts')>()),
	loadEventBundle: server.loadEventBundle,
	loadTeamSeason: server.loadTeamSeason
}));

const bundle = fixtureBundle('USMTBUQ-final');
const member = bundle.matches.find((match) => match.level === 'qual')!.red[0].team;
const team = bundle.teams.find((entry) => entry.number === member)!;

const season: TeamSeason = {
	team,
	events: [
		{ event: { ...bundle.event, hasMatches: true }, stats: null, awards: [] },
		{
			event: {
				...bundle.event,
				code: 'USMTFUTQ',
				name: 'Far Future Qualifier',
				start: '2027-02-06',
				end: '2027-02-06',
				hasMatches: false
			},
			stats: null,
			awards: []
		}
	],
	quickStats: null,
	previousQuickStats: null,
	fetchedAt: 0,
	stale: false
};

function get(number = String(member)) {
	const url = new URL(`https://www.ftcpitstop.com/teams/${number}/calendar.ics`);
	return GET({ params: { number }, url } as never);
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(Date.parse('2026-11-25T12:00:00Z'));
	server.loadTeamSeason.mockReset().mockResolvedValue(season);
	server.loadEventBundle
		.mockReset()
		.mockResolvedValue({ ...bundle, cacheControl: CACHE_CONTROL.finished });
});

afterEach(() => {
	vi.useRealTimers();
});

describe('team calendar endpoint', () => {
	it('lists the team events and matches', async () => {
		const response = await get();
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
		expect(response.headers.get('content-disposition')).toBe(`inline; filename="${member}.ics"`);
		const text = await response.text();
		expect(text).toContain(`X-WR-CALNAME:${member} `);
		expect(text).toContain(`UID:2026-USMTBUQ-${member}@ftcpitstop.com`);
		expect(text).toContain(`UID:2026-USMTFUTQ-${member}@ftcpitstop.com`);
		expect(text).toMatch(new RegExp(`UID:2026-USMTBUQ-q\\d+-${member}@ftcpitstop.com`));
	});

	it('only loads events whose schedule could be out', async () => {
		await get();
		expect(server.loadEventBundle.mock.calls).toEqual([['USMTBUQ']]);
	});

	it('uses a short cache while one of the events is live', async () => {
		expect((await get()).headers.get('cache-control')).toBe(CACHE_CONTROL.short);
		server.loadEventBundle.mockResolvedValue({ ...bundle, cacheControl: CACHE_CONTROL.live });
		expect((await get()).headers.get('cache-control')).toBe(CACHE_CONTROL.live);
	});

	it('still serves the events when match data is down', async () => {
		server.loadEventBundle.mockRejectedValue(new Error('down'));
		const response = await get();
		expect(response.status).toBe(200);
		expect(await response.text()).toContain(`UID:2026-USMTBUQ-${member}@ftcpitstop.com`);
	});

	it('answers unknown teams with a 404', async () => {
		server.loadTeamSeason.mockResolvedValue(null);
		const response = await get('99999');
		expect(response.status).toBe(404);
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.missing);
	});
});
