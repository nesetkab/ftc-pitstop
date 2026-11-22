export const ABOUT_TITLE = 'About the numbers';

export const ABOUT_DESCRIPTION =
	'How PitStop works out OPR, ranking score, match predictions, win chances and queue times for FTC, where the data comes from, and where the numbers fall short.';

export const ABOUT_SECTIONS = [
	{ id: 'opr', title: 'OPR' },
	{ id: 'rankings', title: 'Rankings: RS, TBP and NP' },
	{ id: 'ranking-points', title: 'Ranking points' },
	{ id: 'predictions', title: 'Predictions and win chances' },
	{ id: 'match-impact', title: 'At stake and what changed' },
	{ id: 'queue-times', title: 'Queue times' },
	{ id: 'sources', title: 'Data sources' },
	{ id: 'impossible-scores', title: 'Impossible scores' },
	{ id: 'limits', title: 'Limits' },
	{ id: 'glossary', title: 'Glossary' }
] as const;

export type AboutSectionId = (typeof ABOUT_SECTIONS)[number]['id'];
