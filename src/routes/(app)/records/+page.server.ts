import type { PageServerLoad } from './$types';
import { loadRecordsPage } from './records.server.ts';

export const load: PageServerLoad = ({ url, setHeaders }) => loadRecordsPage(url, setHeaders);
