import { loadRpCounts } from './rp.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadRpCounts(event);
