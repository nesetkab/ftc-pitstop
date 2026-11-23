import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeasonRatings } from '#lib/analysis/types.ts';
import { teamSeason } from '#lib/components/team/fixtures.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { GET as card } from '../[number]/card.svg/+server.ts';
import { GET as badge } from './+server.ts';

const server = vi.hoisted(() => ({ loadTeamSeason: vi.fn(), loadSeasonRatingsWithin: vi.fn() }));

vi.mock('#lib/server/event.ts', () => ({ loadTeamSeason: server.loadTeamSeason }));
vi.mock('#lib/server/analysis.ts', () => ({
	loadSeasonRatingsWithin: server.loadSeasonRatingsWithin
}));

const ratings: SeasonRatings = {
	generatedAt: 0,
	teams: [
		{
			team: 26670,
			opr: 48.7,
			parts: { auto: 10, hive: 0, flower: 0, garden: 0, park: 0, tips: 0 },
			matches: 5,
			events: 1,
			rank: 1,
			percentile: 99,
			region: 'USAZ'
		}
	]
};

function call(handler: (event: never) => unknown, number: string, query = '') {
	const url = new URL(`https://www.ftcpitstop.com/badge/${number}.svg${query}`);
	return handler({ params: { number }, url } as never) as Promise<Response>;
}

beforeEach(() => {
	server.loadTeamSeason.mockReset().mockResolvedValue(teamSeason(26670, 'SCA <Iron> Eagles'));
	server.loadSeasonRatingsWithin.mockReset().mockResolvedValue(ratings);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('badge endpoint', () => {
	it('serves an svg with a long shared cache', async () => {
		const response = await call(badge, '26670');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/svg+xml');
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.badge);
		expect(CACHE_CONTROL.badge).toMatch(/s-maxage=3600\b/);
		expect(CACHE_CONTROL.badge).toMatch(/stale-while-revalidate=86400\b/);
		const svg = await response.text();
		expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
		expect(svg).toContain('OPR 48.7 · 1st worldwide');
		expect(server.loadTeamSeason).toHaveBeenCalledWith(26670);
	});

	it('picks the stat and theme from the query', async () => {
		const region = await (await call(badge, '26670', '?stat=region&theme=dark')).text();
		expect(region).toContain('26670 rank in Arizona');
		expect(region).toContain('#1c1c1c');
		const light = await (await call(badge, '26670', '?stat=nope&theme=neon')).text();
		expect(light).toContain('OPR 48.7');
		expect(light).toContain('#f4f4f2');
	});

	it('answers unknown teams with a 404 image', async () => {
		server.loadTeamSeason.mockResolvedValue(null);
		const response = await call(badge, '99999');
		expect(response.status).toBe(404);
		expect(response.headers.get('content-type')).toBe('image/svg+xml');
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.missing);
		expect(await response.text()).toContain('team not found');
	});

	it('does not look up numbers that cannot be teams', async () => {
		for (const number of ['abc', '0', '123456', '12<x>']) {
			const response = await call(badge, number);
			expect(response.status).toBe(404);
			expect(await response.text()).not.toContain('<x>');
		}
		expect(server.loadTeamSeason).not.toHaveBeenCalled();
	});

	it('caches briefly when the season ratings are not ready', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(null);
		const response = await call(badge, '26670');
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.short);
	});

	it('still answers with an image when the data is down', async () => {
		server.loadTeamSeason.mockRejectedValue(new Error('down'));
		const response = await call(badge, '26670');
		expect(response.status).toBe(503);
		expect(response.headers.get('content-type')).toBe('image/svg+xml');
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.none);
		expect(await response.text()).toContain('data unavailable');
	});
});

describe('card endpoint', () => {
	it('serves the card with escaped names', async () => {
		const response = await call(card, '26670', '?theme=dark');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/svg+xml');
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.badge);
		const svg = await response.text();
		expect(svg).toContain('width="400" height="120"');
		expect(svg).toContain('SCA &lt;Iron&gt; Eagles');
		expect(svg).not.toContain('<Iron>');
	});

	it('answers unknown teams with a 404 card', async () => {
		server.loadTeamSeason.mockResolvedValue(null);
		const response = await call(card, '99999');
		expect(response.status).toBe(404);
		expect(await response.text()).toContain('Team not found');
	});
});
