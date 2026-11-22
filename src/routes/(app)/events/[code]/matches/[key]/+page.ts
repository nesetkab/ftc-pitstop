import { error } from '@sveltejs/kit';
import { isMatchKey } from '#lib/components/event/matches.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent, data }) => {
	const key = params.key.toLowerCase();
	if (!isMatchKey(key)) error(404, 'Match not found');
	const { bundle } = await parent();
	if (!bundle.matches.some((match) => match.key === key)) error(404, 'Match not found');
	return { ...data, key };
};
