import { PART_LABELS, RP_THRESHOLDS } from '#lib/game/biobuzz.ts';

const OPR = 'Offensive power rating, estimated points per match';

function partOpr(part: string, unit: string): string {
	return `Offensive power rating for ${part}, estimated ${unit} per match`;
}

export const GLOSSARY: Readonly<Record<string, string>> = {
	'#': 'Rank',
	RS: 'Ranking score, average ranking points per match',
	TBP: 'Tiebreaker points, average match score without penalties',
	Record: 'Wins, losses and ties',
	'Qual record': 'Qualification wins, losses and ties at every event this season, not playoffs',
	OPR,
	'Season OPR': 'Offensive power rating over the whole season, estimated points per match',
	'OPR here': 'Offensive power rating at this event, estimated points per match',
	'Starting OPR': 'Season OPR coming into this event',
	'Best event OPR': 'Highest offensive power rating at any one event this season',
	'Rank by OPR': 'Where the team would rank at this event if sorted by OPR',
	'World rank': 'Rank among all teams by season OPR',
	'World rank by OPR': 'Rank among all teams by season OPR',
	Strength: 'Average season OPR of the 8 best rated teams at an event',
	'Top 24': 'Average season OPR of the 24 best rated teams at an event',
	'Field avg': 'Average season OPR of every rated team at an event',
	Rated: 'Teams with a season OPR, out of every team at the event',
	"Partners' OPR": 'Average OPR of qualification partners',
	"Opponents' OPR": 'Average OPR of qualification opponents',
	[`${PART_LABELS.auto} OPR`]: partOpr('auto', 'auto points'),
	[`${PART_LABELS.teleop} OPR`]: partOpr('teleop', 'teleop points'),
	[`${PART_LABELS.hive} OPR`]: partOpr('the hive', 'hive points'),
	[`${PART_LABELS.flower} OPR`]: partOpr('flowers', 'flower points'),
	[`${PART_LABELS.garden} OPR`]: partOpr('the garden', 'garden points'),
	[`${PART_LABELS.park} OPR`]: partOpr('parking', 'park points'),
	[`${PART_LABELS.tips} OPR`]: partOpr('tips', 'hive tips'),
	'NP avg': 'Average score without opponent fouls',
	'NP max': 'Best score without opponent fouls',
	'NP min': 'Worst score without opponent fouls',
	Spread: 'Standard deviation of scores without opponent fouls',
	'Avg tips': 'Average hive tips per match',
	'Avg auto': 'Average auto points per match',
	'Avg park': 'Average park points per match',
	Swarm: `Swarm ranking point, leave and park ${RP_THRESHOLDS.swarm}+ points`,
	'Poll. 1': `Pollinator 1 ranking point, ${RP_THRESHOLDS.pollinator1}+ tips`,
	'Poll. 2': `Pollinator 2 ranking point, ${RP_THRESHOLDS.pollinator2}+ tips`,
	'Bonus RS': 'Average bonus ranking points per match from Swarm and Pollinator',
	'Pred.': 'Predicted score',
	[PART_LABELS.auto]: 'Points scored in the autonomous period',
	[PART_LABELS.teleop]: 'Points scored in the driver-controlled period',
	[PART_LABELS.hive]: 'Teleop points from pollen and nectar in the hive',
	[PART_LABELS.flower]: 'Teleop points from flowers the alliance owns',
	[PART_LABELS.garden]: 'Teleop points from pollen and nectar in the garden',
	[PART_LABELS.park]: 'Teleop park points',
	[PART_LABELS.tips]: 'Hive tips in auto and teleop',
	[PART_LABELS.fouls]: 'Points given by the other alliance’s fouls'
};

export function explain(term: string): string | null {
	return Object.hasOwn(GLOSSARY, term) ? GLOSSARY[term] : null;
}

export const ABOUT_PATH = '/about';

export function termId(term: string): string {
	const slug = term
		.toLowerCase()
		.replace('#', 'rank')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return `term-${slug}`;
}

export function termHref(term: string): string | null {
	return explain(term) === null ? null : `${ABOUT_PATH}#${termId(term)}`;
}

export function oprTerm(part: string): string {
	return part === PART_LABELS.total || part === 'OPR' ? 'OPR' : `${part} OPR`;
}
