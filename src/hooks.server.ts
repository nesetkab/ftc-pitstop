import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { describeError } from '#lib/server/errors.ts';
import { withSecurityHeaders } from '#lib/server/security.ts';

export const handle: Handle = async ({ event, resolve }) =>
	withSecurityHeaders(await resolve(event));

export const handleError: HandleServerError = (input) => {
	if (input.kind !== 'unknown') return;
	const { method } = input.event.request;
	const route = input.event.route.id ?? 'unmatched route';
	console.error(`${method} ${route} failed: ${describeError(input.error)}`);
};
