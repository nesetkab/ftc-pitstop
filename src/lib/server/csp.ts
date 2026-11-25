import { createHash } from 'node:crypto';
import type { Config } from '@sveltejs/kit/vite';

type CspDirectives = NonNullable<NonNullable<Config['csp']>['directives']>;

type ScriptHash = `sha256-${string}`;

export const STREAM_FRAME_SOURCES = [
	'https://www.youtube-nocookie.com',
	'https://player.twitch.tv'
] as const;

export function inlineScriptHashes(html: string): ScriptHash[] {
	const hashes: ScriptHash[] = [];
	for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
		const [, attributes, body] = match;
		if (/\bsrc\s*=/i.test(attributes) || body.trim() === '') continue;
		hashes.push(`sha256-${createHash('sha256').update(body).digest('base64')}`);
	}
	return hashes;
}

export function cspDirectives(appHtml: string): CspDirectives {
	return {
		'default-src': ['self'],
		'script-src': ['self', ...inlineScriptHashes(appHtml)],
		'style-src': ['self', 'unsafe-inline'],
		'img-src': ['self', 'data:', 'blob:'],
		'font-src': ['self', 'data:'],
		'connect-src': ['self'],
		'manifest-src': ['self'],
		'worker-src': ['self'],
		'frame-src': [...STREAM_FRAME_SOURCES],
		'object-src': ['none'],
		'base-uri': ['self'],
		'form-action': ['self'],
		'frame-ancestors': ['none']
	};
}
