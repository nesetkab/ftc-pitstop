import { badgeStat, badgeTheme } from '#lib/badge/links.ts';
import { loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { badgeText, MISSING_BADGE, UNAVAILABLE_BADGE } from '#lib/server/badge/load.ts';
import { serveBadge } from '#lib/server/badge/response.ts';
import { renderBadge } from '#lib/server/badge/svg.ts';
import { loadTeamSeason } from '#lib/server/event.ts';
import type { RequestHandler } from './$types';

const deps = { loadTeamSeason, loadSeasonRatings: () => loadSeasonRatingsWithin() };

export const GET: RequestHandler = ({ params, url }) => {
	const stat = badgeStat(url.searchParams.get('stat'));
	const theme = badgeTheme(url.searchParams.get('theme'));
	return serveBadge(params.number, deps, (outcome) => {
		if (outcome.kind === 'found') return renderBadge(badgeText(outcome.facts, stat), theme);
		return renderBadge(outcome.kind === 'missing' ? MISSING_BADGE : UNAVAILABLE_BADGE, theme);
	});
};
