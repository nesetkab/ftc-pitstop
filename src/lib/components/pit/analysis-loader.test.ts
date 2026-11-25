import { describe, expect, it, vi } from 'vitest';
import { analysisLoader } from './analysis-loader.ts';

const remote = vi.hoisted(() => ({ pitAnalysis: vi.fn(async () => ({ code: 'replayed' })) }));

vi.mock('./analysis.remote.ts', () => remote);

describe('analysisLoader', () => {
	it('reads live analysis from the shared CDN cache, one address per data version', async () => {
		const fetcher = vi.fn(async () => Response.json({ code: 'USAZGIQ' }));
		const replay = vi.fn(async () => null);
		const load = analysisLoader(replay, fetcher as unknown as typeof fetch);
		expect(await load({ code: 'USAZGIQ', at: null, version: 'USAZGIQ:quals:44:3' })).toEqual({
			code: 'USAZGIQ'
		});
		expect(fetcher).toHaveBeenCalledWith('/api/events/USAZGIQ/analysis?v=USAZGIQ%3Aquals%3A44%3A3');
		expect(replay).not.toHaveBeenCalled();
	});

	it('leaves replays to the server function and reports failures', async () => {
		const fetcher = vi.fn(async () => new Response('down', { status: 503 }));
		const replay = vi.fn(async () => null);
		const load = analysisLoader(replay, fetcher as unknown as typeof fetch);
		await load({ code: 'USAZGIQ', at: 5, version: 'v' });
		expect(replay).toHaveBeenCalledOnce();
		expect(fetcher).not.toHaveBeenCalled();
		await expect(load({ code: 'USAZGIQ', at: null, version: 'v' })).rejects.toThrow();
	});

	it('loads the server function only when a replay asks for analysis', async () => {
		const fetcher = vi.fn(async () => Response.json({ code: 'USAZGIQ' }));
		const load = analysisLoader(undefined, fetcher as unknown as typeof fetch);
		await load({ code: 'USAZGIQ', at: null, version: 'v' });
		expect(remote.pitAnalysis).not.toHaveBeenCalled();
		const request = { code: 'USAZGIQ', at: 5, version: 'v' };
		expect(await load(request)).toEqual({ code: 'replayed' });
		expect(remote.pitAnalysis).toHaveBeenCalledWith(request);
	});
});
