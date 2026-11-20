import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cspDirectives, inlineScriptHashes } from '#lib/server/csp.ts';
import { DATA_CSP, SECURITY_HEADERS, withSecurityHeaders } from '#lib/server/security.ts';

vi.mock('$app/env/private', () => ({
	FTC_USERNAME: 'pitstop-secret-user',
	FTC_API_KEY: 'F7C2A9E1-SECRET-KEY-0042',
	NEXUS_API_KEY: undefined,
	KV_REST_API_URL: undefined,
	KV_REST_API_TOKEN: 'AXXXredis-secret-token-5521',
	UPSTASH_REDIS_REST_URL: undefined,
	UPSTASH_REDIS_REST_TOKEN: undefined
}));

const { handle, handleError } = await import('../../src/hooks.server.ts');

const root = fileURLToPath(new URL('../../', import.meta.url));
const appHtml = readFileSync(`${root}src/app.html`, 'utf8');
const viteConfig = readFileSync(`${root}vite.config.ts`, 'utf8');

afterEach(() => vi.restoreAllMocks());

function respond(response: Response) {
	return handle({ event: {} as never, resolve: async () => response } as never);
}

describe('security headers', () => {
	it('are set on pages', async () => {
		const page = await respond(new Response('<p>hi</p>', { headers: { 'content-type': 'text/html' } }));
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
			expect(page.headers.get(name), name).toBe(value);
		}
		expect(page.headers.get('content-security-policy')).toBeNull();
		expect(await page.text()).toBe('<p>hi</p>');
	});

	it('forbid sniffing, framing, device features and leaking paths', () => {
		expect(SECURITY_HEADERS['x-content-type-options']).toBe('nosniff');
		expect(SECURITY_HEADERS['x-frame-options']).toBe('DENY');
		expect(SECURITY_HEADERS['referrer-policy']).toBe('strict-origin-when-cross-origin');
		expect(SECURITY_HEADERS['cross-origin-opener-policy']).toBe('same-origin');
		const policy = SECURITY_HEADERS['permissions-policy'];
		for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
			expect(policy).toContain(`${feature}=()`);
		}
		for (const feature of ['fullscreen', 'screen-wake-lock', 'clipboard-write', 'notifications']) {
			expect(policy).not.toContain(feature);
		}
	});

	it('lock down answers that are not pages', async () => {
		const json = await respond(Response.json({ ok: true }, { status: 404 }));
		expect(json.status).toBe(404);
		expect(json.headers.get('content-security-policy')).toBe(DATA_CSP);
		expect(DATA_CSP).toContain("default-src 'none'");
		expect(DATA_CSP).toContain("frame-ancestors 'none'");
		expect(await json.json()).toEqual({ ok: true });
		const plain = await respond(new Response('text'));
		expect(plain.headers.get('content-security-policy')).toBe(DATA_CSP);
	});

	it('leave a policy that is already there alone', async () => {
		const answer = await respond(
			new Response('x', { headers: { 'content-security-policy': "default-src 'self'" } })
		);
		expect(answer.headers.get('content-security-policy')).toBe("default-src 'self'");
	});

	it('work on answers whose headers cannot be changed', async () => {
		const redirect = await respond(Response.redirect('https://example.com/next', 308));
		expect(redirect.status).toBe(308);
		expect(redirect.headers.get('location')).toBe('https://example.com/next');
		expect(redirect.headers.get('x-content-type-options')).toBe('nosniff');
		const fetched = await respond(
			new Response('body', { status: 201, statusText: 'Made', headers: { 'x-keep': '1' } })
		);
		expect(fetched.status).toBe(201);
		expect(fetched.headers.get('x-keep')).toBe('1');
		expect(withSecurityHeaders(fetched)).toBe(fetched);
	});
});

describe('content security policy', () => {
	const directives = cspDirectives(appHtml);
	const text = JSON.stringify(directives);

	it('only runs scripts from this site and the inline scripts it knows', () => {
		const script = directives['script-src'] ?? [];
		expect(script[0]).toBe('self');
		expect(script).not.toContain('unsafe-inline');
		expect(script).not.toContain('unsafe-eval');
		expect(script).not.toContain('*');
		for (const source of script.slice(1)) expect(source).toMatch(/^sha256-[A-Za-z0-9+/]{43}=$/);
		expect(script.length).toBeGreaterThan(1);
	});

	it('hashes every inline script in the page template exactly as the browser does', () => {
		const inline = [...appHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
		expect(inline.length).toBeGreaterThan(0);
		const expected = inline.map(
			(body) => `sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`
		);
		expect(inlineScriptHashes(appHtml)).toEqual(expected);
		for (const hash of expected) expect(directives['script-src']).toContain(hash);
	});

	it('follows the template when it changes', () => {
		const changed = appHtml.replace('localStorage.getItem', 'sessionStorage.getItem');
		expect(inlineScriptHashes(changed)).not.toEqual(inlineScriptHashes(appHtml));
		expect(inlineScriptHashes('<script src="/x.js"></script><script> </script>')).toEqual([]);
	});

	it('keeps the site out of frames and blocks plugins, base tags and foreign forms', () => {
		expect(directives['frame-ancestors']).toEqual(['none']);
		expect(directives['frame-src']).toEqual(['none']);
		expect(directives['object-src']).toEqual(['none']);
		expect(directives['base-uri']).toEqual(['self']);
		expect(directives['form-action']).toEqual(['self']);
		expect(directives['default-src']).toEqual(['self']);
	});

	it('only talks to this site', () => {
		expect(directives['connect-src']).toEqual(['self']);
		expect(directives['worker-src']).toEqual(['self']);
		expect(directives['manifest-src']).toEqual(['self']);
		expect(text).not.toMatch(/https?:|\*/);
	});

	it('is the policy the build uses', () => {
		expect(viteConfig).toContain('cspDirectives(appHtml)');
		expect(viteConfig).toMatch(/csp:\s*\{\s*mode:\s*'hash'/);
		expect(viteConfig).toMatch(/trustedOrigins:\s*\[\s*\]/);
	});
});

describe('server errors', () => {
	function fail(input: { kind: string; error: unknown }) {
		const logs: string[] = [];
		vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
			logs.push(args.map(String).join(' '));
		});
		const result = handleError({
			...input,
			event: {
				request: new Request('http://localhost/api/workspace/QWERTY'),
				route: { id: '/api/workspace/[code]' },
				url: new URL('http://localhost/api/workspace/QWERTY')
			}
		} as never);
		return { result, logs };
	}

	it('log what happened without secrets, paths or commands', () => {
		const { result, logs } = fail({
			kind: 'unknown',
			error: new Error(
				'Command failed: WRONGPASS AXXXredis-secret-token-5521, command was: ["GET","pitstop:ws:QWERTY:meta"]'
			)
		});
		expect(result).toBeUndefined();
		expect(logs).toHaveLength(1);
		expect(logs[0]).toContain('GET /api/workspace/[code] failed: Error Command failed');
		for (const secret of ['AXXXredis-secret-token-5521', 'QWERTY', 'command was']) {
			expect(logs[0]).not.toContain(secret);
		}
	});

	it('stay quiet about errors the app raised on purpose and pages that do not exist', () => {
		for (const input of [
			{ kind: 'framework', error: { status: 404, message: 'Not Found' } },
			{ kind: 'app', error: { message: 'Event not found' } },
			{ kind: 'validation', error: { status: 400, message: 'Bad Request' } }
		]) {
			const { result, logs } = fail(input);
			expect(result).toBeUndefined();
			expect(logs).toEqual([]);
		}
	});

	it('leave the visitor with the default message, not the detail', () => {
		const { result } = fail({
			kind: 'unknown',
			error: new TypeError('secret detail F7C2A9E1-SECRET-KEY-0042')
		});
		expect(JSON.stringify(result ?? {})).not.toContain('F7C2A9E1');
	});
});
