import { notShared, workspaceApi } from '#lib/workspace/shared.server.ts';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = ({ request, params }) => {
	const api = workspaceApi();
	return api ? api.write(request, params.code, params.doc) : notShared();
};
