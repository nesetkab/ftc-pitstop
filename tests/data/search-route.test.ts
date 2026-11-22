import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
	searchIndex: vi.fn(async () => ({ teams: [], events: [], fetchedAt: 1 })),
	loadSeasonRatingsWithin: vi.fn(async (_ms?: number) => ({
		generatedAt: 1,
		teams: [{ team: 3747, opr: 80, rank: 3, matches: 9 }]
	})),
	search: vi.fn(
		(_index: unknown, _query: string, _limit: number, _options?: { standings?: Map<number, unknown> }) => ({
			teams: [],
			events: []
		})
	)
}));

vi.mock('#lib/server/event.ts', () => ({ searchIndex: server.searchIndex }));
vi.mock('#lib/server/analysis.ts', () => ({
	loadSeasonRatingsWithin: server.loadSeasonRatingsWithin
}));
vi.mock('#lib/server/search.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/server/search.ts')>()),
	search: server.search
}));

const { GET } = await import('../../src/routes/api/search/+server.ts');

function get(query: string) {
	return GET({ url: new URL(`http://localhost/api/search${query}`) } as never);
}

beforeEach(() => {
	server.searchIndex.mockClear();
	server.search.mockClear();
});

describe('search route', () => {
	it('cuts long queries before searching', async () => {
		await get(`?q=${'a'.repeat(5000)}`);
		expect(server.search).toHaveBeenCalledOnce();
		expect(server.search.mock.calls[0][1]).toBe('a'.repeat(80));
	});

	it('keeps the number of results within bounds', async () => {
		for (const [limit, expected] of [
			['1000', 25],
			['25', 25],
			['0', 10],
			['-3', 1],
			['abc', 10],
			['', 10],
			['3.7', 3],
			['Infinity', 25]
		] as const) {
			server.search.mockClear();
			await get(`?q=valley&limit=${limit}`);
			expect(server.search.mock.calls[0][2], `limit=${limit}`).toBe(expected);
		}
	});

	it('does not load anything for an empty query', async () => {
		for (const query of ['', '?q=', '?q=%20%20', '?limit=5']) {
			const answer = await get(query);
			expect(answer.status).toBe(200);
			expect(await answer.json()).toEqual({ teams: [], events: [] });
		}
		expect(server.searchIndex).not.toHaveBeenCalled();
		expect(server.search).not.toHaveBeenCalled();
	});

	it('passes season standings without waiting long for them', async () => {
		await get('?q=hive');
		expect(server.loadSeasonRatingsWithin.mock.calls[0][0]).toBeLessThanOrEqual(500);
		expect(server.search.mock.calls[0][3]?.standings?.get(3747)).toEqual({ opr: 80, rank: 3 });
	});

	it('still searches when standings are unavailable', async () => {
		server.loadSeasonRatingsWithin.mockRejectedValueOnce(new Error('down'));
		const answer = await get('?q=hive');
		expect(answer.status).toBe(200);
		expect(server.search.mock.calls[0][3]?.standings).toBeUndefined();
	});

	it('shares answers for an hour', async () => {
		const answer = await get('?q=valley');
		expect(answer.headers.get('cache-control')).toContain('s-maxage=3600');
	});
});
