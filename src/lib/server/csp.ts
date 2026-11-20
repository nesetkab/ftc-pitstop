import { createHash } from 'node:crypto';
import type { CspDirectives } from '@sveltejs/kit';

export function inlineScriptHashes(html: string): string[] {
	const hashes: string[] = [];
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
		'frame-src': ['none'],
		'object-src': ['none'],
		'base-uri': ['self'],
		'form-action': ['self'],
		'frame-ancestors': ['none']
	};
}
