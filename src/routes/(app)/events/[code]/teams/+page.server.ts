import type { Config } from '@sveltejs/adapter-vercel';
import { loadSeasonRatings } from '#lib/server/analysis.ts';
import type { PageServerLoad } from './$types';

export const config: Config = { isr: { expiration: 60 } };

export const load: PageServerLoad = async ({ parent }) => {
	const [{ bundle }, ratings] = await Promise.all([
		parent(),
		loadSeasonRatings().catch(() => null)
	]);
	if (!ratings || ratings.teams.length === 0) return { season: null, seasonCount: null };
	const here = new Set(bundle.teams.map((team) => team.number));
	const season: Record<number, { opr: number; rank: number }> = {};
	for (const rating of ratings.teams) {
		if (here.has(rating.team)) season[rating.team] = { opr: rating.opr, rank: rating.rank };
	}
	return { season, seasonCount: ratings.teams.length };
};
