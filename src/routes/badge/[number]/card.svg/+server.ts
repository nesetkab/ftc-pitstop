import { badgeQuery, badgeTheme } from '#lib/badge/links.ts';
import { loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { cardData, missingCard, TEAM_NUMBER, unavailableCard } from '#lib/server/badge/load.ts';
import { serveBadge } from '#lib/server/badge/response.ts';
import { renderCard } from '#lib/server/badge/svg.ts';
import { canonicalRedirect } from '#lib/server/canonical.ts';
import { loadTeamSeason } from '#lib/server/event.ts';
import type { RequestHandler } from './$types';

const deps = { loadTeamSeason, loadSeasonRatings: () => loadSeasonRatingsWithin() };

export const GET: RequestHandler = ({ params, url }) => {
	const theme = badgeTheme(url.searchParams.get('theme'));
	const moved =
		TEAM_NUMBER.test(params.number) && canonicalRedirect(url, badgeQuery('card', theme));
	if (moved) return moved;
	return serveBadge(params.number, deps, (outcome) => {
		if (outcome.kind === 'found') return renderCard(cardData(outcome.facts), theme);
		return renderCard(outcome.kind === 'missing' ? missingCard() : unavailableCard(), theme);
	});
};
