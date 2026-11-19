import type { Bar } from '#lib/ui/Bars.svelte';
import type { KeyValueItem } from '#lib/ui/KeyValue.svelte';
import type { LinePoint } from '#lib/ui/LineChart.svelte';
import type { MatchListItem } from '#lib/ui/MatchList.svelte';
import type { PredictionSide } from '#lib/ui/PredictionCard.svelte';
import type { SearchResult } from '#lib/ui/search.svelte.ts';
import type { Tab } from '#lib/ui/Tabs.svelte';
import { rankings } from './rankings.ts';

export const ME = 14624;

export const EVENT = {
	code: 'USAZGIQ',
	name: 'Roadrunner - Gilbert Qualifier',
	timeZone: 'America/Phoenix',
	start: '2026-11-14',
	meta: 'Qualifier at Gilbert Christian High School, Gilbert, Arizona. Saturday, November 14, 2026.'
};

export const eventTabs: Tab[] = [
	{ href: `/events/${EVENT.code}/rankings`, label: 'Rankings' },
	{ href: `/events/${EVENT.code}/schedule`, label: 'Schedule' },
	{ href: `/events/${EVENT.code}/results`, label: 'Results' },
	{ href: `/events/${EVENT.code}/playoffs`, label: 'Playoffs' },
	{ href: `/events/${EVENT.code}/teams`, label: 'Teams' },
	{ href: `/events/${EVENT.code}/awards`, label: 'Awards' },
	{ href: `/events/${EVENT.code}/alliance-selection`, label: 'Alliance selection' }
];

export const strength = [
	{
		team: 26128,
		name: 'Wrightly Reconfigured Robots',
		rank: 14,
		epaRank: 3,
		partners: 29.0,
		opponents: 30.3
	},
	{
		team: 25620,
		name: 'Hexadecimal Nibble',
		rank: 20,
		epaRank: 10,
		partners: 28.3,
		opponents: 39.5
	},
	{ team: 2844, name: 'Valley X Robotics', rank: 12, epaRank: 6, partners: 20.3, opponents: 30.3 },
	{
		team: 14624,
		name: 'Cat-Astrophic Byte',
		rank: 7,
		epaRank: 13,
		partners: 34.6,
		opponents: 19.4
	},
	{ team: 15058, name: 'RoboJags', rank: 5, epaRank: 17, partners: 32.8, opponents: 23.7 }
];

export const available = [
	{
		team: 2844,
		name: 'Valley X Robotics',
		opr: 47.4,
		auto: 24.5,
		tips: 2.2,
		park: 7.0,
		round1: 0.76,
		final: 0.05
	},
	{
		team: 36980,
		name: 'The Titans',
		opr: 40.0,
		auto: 23.3,
		tips: 2.6,
		park: 5.0,
		round1: 0.67,
		final: 0.02
	},
	{
		team: 37557,
		name: 'Grape Nerds',
		opr: 38.9,
		auto: 15.0,
		tips: 2.6,
		park: 5.0,
		round1: 0.66,
		final: 0.02
	},
	{
		team: 12841,
		name: '+3 Robotics',
		opr: 35.1,
		auto: 9.1,
		tips: 1.6,
		park: 8.0,
		round1: 0.6,
		final: 0.01
	},
	{
		team: 22258,
		name: 'Herobotix Beanie Bots',
		opr: 31.9,
		auto: 11.8,
		tips: 1.6,
		park: 6.0,
		round1: 0.56,
		final: 0.01
	}
];

export const picked = {
	team: 26128,
	name: 'Wrightly Reconfigured Robots',
	opr: 52.8,
	auto: 6.8,
	tips: 2.8,
	park: 8.0,
	by: 3
};

export const prediction: { red: PredictionSide; blue: PredictionSide } = {
	red: {
		teams: [
			{ number: 14624, name: 'Cat-Astrophic Byte' },
			{ number: 25620, name: 'Hexadecimal Nibble' }
		],
		win: 0.51,
		score: 58
	},
	blue: {
		teams: [
			{ number: 32043, name: 'FALCON ROBOTICS' },
			{ number: 22258, name: 'Herobotix Beanie Bots' }
		],
		win: 0.49,
		score: 57
	}
};

export const rankingPoints = [
	{ label: 'Win', red: 0.51, blue: 0.49 },
	{ label: 'Swarm, leave and park 16+', red: 0.23, blue: 0.27 },
	{ label: 'Pollinator 1, 4+ tips', red: 0.13, blue: 0.11 },
	{ label: 'Pollinator 2, 7+ tips', red: 0.004, blue: 0.003 }
];

export const expectedRp = { red: 1.89, blue: 1.85 };

export const pointBars: Bar[] = [
	{ label: 'Hive', value: 40.0 },
	{ label: 'Auto', value: 17.7 },
	{ label: 'Park', value: 7.3 },
	{ label: 'Garden', value: 1.5 },
	{ label: 'Flowers', value: 0 }
];

export const epaLine: LinePoint[] = [
	{ label: 'Start', value: 29.0 },
	{ label: 'Q1', value: 36.8 },
	{ label: 'Q12', value: 48.5 },
	{ label: 'Q15', value: 55.1 },
	{ label: 'Q22', value: 54.8 },
	{ label: 'Q32', value: 52.6 },
	{ label: 'M3', value: 54.9 },
	{ label: 'M7', value: 54.2 },
	{ label: 'M9', value: 52.0 },
	{ label: 'M10', value: 49.6 }
];

export const percentiles = [
	{ label: 'Total', opr: 58.2, percentile: 93 },
	{ label: 'Auto', opr: 13.2, percentile: 81 },
	{ label: 'Teleop', opr: 45.0, percentile: 95 }
];

export const phoneFacts: KeyValueItem[] = [
	{ key: 'Rank', value: '7 of 27' },
	{ key: 'Record', value: '3-0-0' },
	{ key: 'Ranking score', value: '3.33' },
	{ key: 'Chance of top 8', value: '59%' }
];

export const ourMatches: MatchListItem[] = [
	{ label: 'Q5', status: 'Won', detail: 'with 15058', value: '36–26', state: 'done' },
	{ label: 'Q14', status: 'Won', detail: 'with 18421', value: '74–26', state: 'done' },
	{ label: 'Q17', status: 'Won', detail: 'with 2844', value: '61–22', state: 'done' },
	{ label: 'Q26', status: '1:58 PM', detail: 'Red, with 25620', value: '51%', state: 'next' },
	{ label: 'Q31', status: '2:31 PM', detail: 'Blue, with 26128', value: '86%', state: 'upcoming' }
];

export const alerts = [
	{ label: 'Two matches before ours', on: true },
	{ label: 'Our score is posted', on: true },
	{ label: 'Our rank changes', on: false },
	{ label: 'Alliance selection starts', on: true }
];

const searchable: SearchResult[] = [
	...rankings.map((row) => ({
		type: 'team' as const,
		label: `${row.team} ${row.name}`,
		sublabel: `Rank ${row.rank} at the ${EVENT.name}`,
		href: `/teams/${row.team}`
	})),
	{
		type: 'event',
		label: EVENT.name,
		sublabel: 'USAZGIQ. Gilbert, Arizona. November 14, 2026.',
		href: `/events/${EVENT.code}`
	},
	{
		type: 'event',
		label: 'Montana Qualifier - Butte MT-Tech',
		sublabel: 'USMTBUQ. Butte, Montana. November 20 and 21, 2026.',
		href: '/events/USMTBUQ'
	}
];

export async function sampleSearch(query: string): Promise<SearchResult[]> {
	const needle = query.toLowerCase();
	return searchable
		.filter((result) => `${result.label} ${result.sublabel ?? ''}`.toLowerCase().includes(needle))
		.slice(0, 8);
}

export { rankings };
