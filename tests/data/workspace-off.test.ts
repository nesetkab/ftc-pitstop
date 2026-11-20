import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/private', () => ({
	FTC_USERNAME: undefined,
	FTC_API_KEY: undefined,
	NEXUS_API_KEY: undefined,
	KV_REST_API_URL: undefined,
	KV_REST_API_TOKEN: undefined,
	UPSTASH_REDIS_REST_URL: 'https://only-one-half.upstash.io',
	UPSTASH_REDIS_REST_TOKEN: undefined
}));

const { POST: create } = await import('../../src/routes/api/workspace/+server.ts');
const { GET: load } = await import('../../src/routes/api/workspace/[code]/+server.ts');
const { PUT: write } = await import('../../src/routes/api/workspace/[code]/[doc]/+server.ts');
const { sharedWorkspaces } = await import('#lib/workspace/shared.server.ts');

const getClientAddress = () => '203.0.113.7';

function json(method: string, path: string, body: unknown) {
	return new Request(`http://localhost${path}`, {
		method,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

afterEach(() => vi.unstubAllGlobals());

describe('workspaces without Redis', () => {
	it('are switched off for every route and never touch the network', async () => {
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		expect(sharedWorkspaces()).toBe(false);
		const answers = [
			await create({
				request: json('POST', '/api/workspace', { teamNumber: 1 }),
				getClientAddress
			} as never),
			await load({
				request: new Request('http://localhost/api/workspace/ABCDEF'),
				params: { code: 'ABCDEF' },
				getClientAddress
			} as never),
			await write({
				request: json('PUT', '/api/workspace/ABCDEF/picklist', { data: {} }),
				params: { code: 'ABCDEF', doc: 'picklist' },
				getClientAddress
			} as never)
		];
		for (const answer of answers) {
			expect(answer.status).toBe(404);
			expect(answer.headers.get('cache-control')).toBe('no-store');
			expect(await answer.json()).toEqual({ error: 'Shared workspaces are not turned on' });
		}
		expect(fetcher).not.toHaveBeenCalled();
	});
});
