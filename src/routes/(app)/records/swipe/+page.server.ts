import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadRecordsPage } from '../records.server.ts';

const LIVE_HOSTS = new Set(['www.ftcpitstop.com', 'ftcpitstop.com']);

export const load: PageServerLoad = ({ url, setHeaders }) => {
	if (LIVE_HOSTS.has(url.hostname)) error(404, 'Not found');
	return loadRecordsPage(url, setHeaders);
};
