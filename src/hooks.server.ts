import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { describeError } from '#lib/server/errors.ts';
import { legacyRedirect } from '#lib/server/legacy.ts';
import { withSecurityHeaders } from '#lib/server/security.ts';
import { withSocialTags } from '#lib/server/social.ts';

export const handle: Handle = async ({ event, resolve }) => {
	const target = legacyRedirect(event.url.pathname);
	if (target) {
		return withSecurityHeaders(new Response(null, { status: 308, headers: { location: target } }));
	}
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => withSocialTags(html, event.url)
	});
	return withSecurityHeaders(response);
};

export const handleError: HandleServerError = (input) => {
	if (input.kind !== 'unknown') return;
	const { method } = input.event.request;
	const route = input.event.route.id ?? 'unmatched route';
	console.error(`${method} ${route} failed: ${describeError(input.error)}`);
};
