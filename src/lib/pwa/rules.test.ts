import { describe, expect, it } from 'vitest';
import { isCacheableResponse, isDataRequest } from './rules.ts';

describe('isDataRequest', () => {
	it('keeps public data and pages available offline', () => {
		expect(isDataRequest('/api/events/USAZGIQ', '/', 'cors')).toBe(true);
		expect(isDataRequest('/api/teams/2844', '/', 'same-origin')).toBe(true);
		expect(isDataRequest('/events/USAZGIQ', '/', 'navigate')).toBe(true);
		expect(isDataRequest('/pit/api/events/X', '/pit/', 'cors')).toBe(true);
	});

	it('leaves workspace traffic to the network, whatever the request looks like', () => {
		for (const mode of ['cors', 'navigate', 'same-origin']) {
			expect(isDataRequest('/api/workspace', '/', mode)).toBe(false);
			expect(isDataRequest('/api/workspace/ABCDEF', '/', mode)).toBe(false);
			expect(isDataRequest('/api/workspace/ABCDEF/picklist', '/', mode)).toBe(false);
			expect(isDataRequest('/pit/api/workspace/ABCDEF', '/pit/', mode)).toBe(false);
		}
	});

	it('does not confuse similar names with the workspace api', () => {
		expect(isDataRequest('/api/workspaces-list', '/', 'cors')).toBe(true);
	});

	it('ignores other requests', () => {
		expect(isDataRequest('/_app/remote/abc/pitAnalysis', '/', 'cors')).toBe(false);
		expect(isDataRequest('/favicon.svg', '/', 'no-cors')).toBe(false);
	});
});

describe('isCacheableResponse', () => {
	const make = (status: number, headers: Record<string, string> = {}) => ({
		status,
		headers: new Headers(headers)
	});

	it('stores plain successful answers', () => {
		expect(isCacheableResponse(make(200))).toBe(true);
		expect(isCacheableResponse(make(200, { 'cache-control': 'public, s-maxage=30' }))).toBe(true);
	});

	it.each(['no-store', 'private', 'private, max-age=60', 'public, no-store', 'NO-STORE'])(
		'does not store answers marked %j',
		(control) => {
			expect(isCacheableResponse(make(200, { 'cache-control': control }))).toBe(false);
		}
	);

	it('does not store errors, partial answers or answers that set cookies', () => {
		expect(isCacheableResponse(make(404))).toBe(false);
		expect(isCacheableResponse(make(206))).toBe(false);
		expect(isCacheableResponse(make(503))).toBe(false);
		expect(isCacheableResponse(make(200, { 'set-cookie': 'a=b' }))).toBe(false);
	});
});
