import { error } from '@sveltejs/kit';
import { normalizeTeamNumber } from '#lib/server/event.ts';
import { loadReporter } from '../../report.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	let number: number;
	try {
		number = normalizeTeamNumber(event.params.number);
	} catch {
		error(404, 'Team not found at this event');
	}
	const { report } = await loadReporter(event);
	const found = report(number);
	if (!found) error(404, 'Team not found at this event');
	return { report: found };
};
