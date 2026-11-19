import { error } from '@sveltejs/kit';
import { SHARE_TOOLS } from '#lib/workspace/schemas.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const tool = SHARE_TOOLS.find((item) => item === params.tool);
	if (!tool) error(404, 'Not found');
	return { tool };
};
