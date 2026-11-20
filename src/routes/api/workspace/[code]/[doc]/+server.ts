import { clientAddress, notShared, workspaceApi } from '#lib/workspace/shared.server.ts';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = ({ request, params, getClientAddress }) => {
	const api = workspaceApi();
	return api
		? api.write(request, params.code, params.doc, clientAddress(getClientAddress))
		: notShared();
};
