import { loadBreakdowns } from '../breakdowns.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadBreakdowns(event);
