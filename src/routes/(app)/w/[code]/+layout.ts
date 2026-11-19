import { error, redirect } from '@sveltejs/kit';
import { normalizeCode } from '#lib/workspace/code.ts';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = ({ params, url }) => {
	const code = normalizeCode(params.code);
	if (!code) error(404, 'No workspace uses this code');
	if (code !== params.code) {
		redirect(307, `${url.pathname.replace(params.code, code)}${url.search}${url.hash}`);
	}
	return { code };
};
