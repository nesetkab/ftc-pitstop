import { clientAddress, notShared, workspaceApi } from '#lib/workspace/shared.server.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request, params, getClientAddress }) => {
	const api = workspaceApi();
	return api ? api.load(request, params.code, clientAddress(getClientAddress)) : notShared();
};
