import { badgeTheme } from '#lib/badge/links.ts';
import { loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { cardData, missingCard, unavailableCard } from '#lib/server/badge/load.ts';
import { serveBadge } from '#lib/server/badge/response.ts';
import { renderCard } from '#lib/server/badge/svg.ts';
import { loadTeamSeason } from '#lib/server/event.ts';
import type { RequestHandler } from './$types';

const deps = { loadTeamSeason, loadSeasonRatings: () => loadSeasonRatingsWithin() };

export const GET: RequestHandler = ({ params, url }) => {
	const theme = badgeTheme(url.searchParams.get('theme'));
	return serveBadge(params.number, deps, (outcome) => {
		if (outcome.kind === 'found') return renderCard(cardData(outcome.facts), theme);
		return renderCard(outcome.kind === 'missing' ? missingCard() : unavailableCard(), theme);
	});
};
