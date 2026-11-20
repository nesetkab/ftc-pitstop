import { error, redirect } from '@sveltejs/kit';
import { normalizeCode } from '#lib/workspace/code.ts';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = ({ params, url }) => {
	const code = normalizeCode(params.code);
	if (!code) error(404, 'No workspace uses this code');
	if (code !== params.code) {
		const path = url.pathname.replace(/^\/w\/[^/]+/, `/w/${code}`);
		redirect(307, `${path}${url.search}${url.hash}`);
	}
	return { code };
};
