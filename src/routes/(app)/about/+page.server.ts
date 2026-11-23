import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => {
	setHeaders({ 'cache-control': CACHE_CONTROL.list });
};
