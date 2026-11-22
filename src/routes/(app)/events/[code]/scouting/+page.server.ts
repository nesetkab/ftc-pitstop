import type { TeamReport } from '#lib/components/event/report.ts';
import { loadReporter } from '../report.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { bundle, report } = await loadReporter(event);
	const reports = bundle.teams
		.map((team) => report(team.number))
		.filter((entry): entry is TeamReport => entry !== null);
	return { reports };
};
