import { error } from '@sveltejs/kit';
import type { Config } from '@sveltejs/adapter-vercel';
import { isMatchKey } from '#lib/components/event/matches.ts';
import type { PageLoad } from './$types';

export const config: Config = { isr: { expiration: 60 } };

export const load: PageLoad = async ({ params, parent }) => {
	const key = params.key.toLowerCase();
	if (!isMatchKey(key)) error(404, 'Match not found');
	const { bundle } = await parent();
	if (!bundle.matches.some((match) => match.key === key)) error(404, 'Match not found');
	return { key };
};
