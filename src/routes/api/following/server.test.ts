import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { GET } from './+server.ts';

const home = vi.hoisted(() => ({ loadFollowed: vi.fn() }));

vi.mock('#lib/server/home.ts', () => home);

function call(query: string) {
	return GET({
		url: new URL(`http://localhost/api/following${query}`)
	} as never) as Promise<Response>;
}

beforeEach(() => {
	home.loadFollowed.mockReset();
});

describe('followed teams endpoint', () => {
	it('loads the requested teams in one call with a short cache', async () => {
		home.loadFollowed.mockResolvedValue([{ number: 3747 }, { number: 26670 }]);
		const response = await call('?teams=3747,26670,3747,nope');
		expect(home.loadFollowed).toHaveBeenCalledTimes(1);
		expect(home.loadFollowed).toHaveBeenCalledWith([3747, 26670]);
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.short);
		expect(await response.json()).toEqual({ teams: [{ number: 3747 }, { number: 26670 }] });
	});

	it('caps how many teams one request can ask for', async () => {
		home.loadFollowed.mockResolvedValue([]);
		const many = Array.from({ length: 40 }, (_, index) => index + 1).join(',');
		await call(`?teams=${many}`);
		expect(home.loadFollowed.mock.calls[0][0]).toHaveLength(12);
	});

	it('answers an empty list without loading anything', async () => {
		const response = await call('?teams=abc');
		expect(await response.json()).toEqual({ teams: [] });
		expect(home.loadFollowed).not.toHaveBeenCalled();
	});

	it('does not cache a failure', async () => {
		home.loadFollowed.mockRejectedValue(new Error('down'));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const response = await call('?teams=3747');
		expect(response.status).toBe(503);
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.none);
	});
});
