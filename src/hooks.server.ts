import type { Handle, HandleServerError } from '@sveltejs/kit';
import { describeError } from '#lib/server/errors.ts';
import { withSecurityHeaders } from '#lib/server/security.ts';

export const handle: Handle = async ({ event, resolve }) =>
	withSecurityHeaders(await resolve(event));

export const handleError: HandleServerError = ({ error, event, status }) => {
	if (status !== 404) {
		console.error(
			`${event.request.method} ${event.route.id ?? 'unmatched route'} failed with ${status}: ${describeError(error)}`
		);
	}
	return { message: status === 404 ? 'Not Found' : 'Internal Error' };
};
