import { clientAddress, notShared, workspaceApi } from '#lib/workspace/shared.server.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request, getClientAddress }) => {
	const api = workspaceApi();
	return api ? api.create(request, clientAddress(getClientAddress)) : notShared();
};
