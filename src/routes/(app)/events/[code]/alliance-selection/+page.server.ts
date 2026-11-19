import { error } from '@sveltejs/kit';
import { loadEventAnalysis } from '#lib/server/analysis.ts';
import { DataError } from '#lib/server/errors.ts';
import { loadEventBundle } from '#lib/server/event.ts';
import { sharedWorkspaces } from '#lib/workspace/shared.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, depends }) => {
	depends('app:alliance-selection');
	try {
		const [bundle, analysis] = await Promise.all([
			loadEventBundle(params.code),
			loadEventAnalysis(params.code).catch(() => null)
		]);
		return { selection: { bundle, analysis }, workspaceShared: sharedWorkspaces() };
	} catch (cause) {
		if (cause instanceof DataError) error(cause.status, cause.message);
		throw cause;
	}
};
