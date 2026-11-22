import { eventMeta } from '#lib/components/event/event-meta.ts';
import { fixed, integer } from '#lib/format/number.ts';
import { ordinal } from '#lib/format/ordinal.ts';
import type { Event, Match } from '#lib/types.ts';

export const SITE_NAME = 'PitStop';
export const SEASON_NAME = '2026-27 BIOBUZZ';

export type JsonLd = Record<string, unknown>;

export type EventStatusWord = 'upcoming' | 'live' | 'done';

export function siteTitle(text: string): string {
	return `${text} - ${SITE_NAME}`;
}

export function jsonLdScript(data: JsonLd): string {
	const json = JSON.stringify(data)
		.replaceAll('<', '\\u003c')
		.replaceAll('>', '\\u003e')
		.replaceAll('&', '\\u0026')
		.replaceAll(' ', '\\u2028')
		.replaceAll(' ', '\\u2029');
	return `<script type="application/ld+json">${json}</script>`;
}

export function breadcrumbs(origin: string, items: { name: string; path: string }[]): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			item: `${origin}${item.path}`
		}))
	};
}

type SeoArticle = {
	path: string;
	headline: string;
	description: string;
	sections: string[];
};

export function articleJsonLd(origin: string, article: SeoArticle): JsonLd {
	const site = { '@type': 'WebSite', name: SITE_NAME, url: `${origin}/` };
	return {
		'@context': 'https://schema.org',
		'@type': 'TechArticle',
		headline: article.headline,
		description: article.description,
		url: `${origin}${article.path}`,
		mainEntityOfPage: `${origin}${article.path}`,
		inLanguage: 'en',
		articleSection: article.sections,
		isPartOf: site,
		publisher: { '@type': 'Organization', name: SITE_NAME, url: `${origin}/` }
	};
}

type SeoTeam = { number: number; name: string; place: string; rookieYear: number | null };

type SeoTeamStats = {
	opr: number | null;
	rank: number | null;
	of: number | null;
	record: { wins: number; losses: number; ties: number } | null;
	events: number;
};

export function teamTitle(team: SeoTeam): string {
	const where = team.place ? ` (${team.place})` : '';
	return siteTitle(`FTC ${team.number} ${team.name}${where}`);
}

export function teamDescription(team: SeoTeam, stats: SeoTeamStats): string {
	const from = team.place ? ` from ${team.place}` : '';
	const parts = [`FTC team ${team.number} ${team.name}${from}.`];
	if (stats.opr !== null) {
		const rank =
			stats.rank !== null && stats.of !== null
				? `, ${ordinal(stats.rank)} of ${integer(stats.of)} teams worldwide`
				: '';
		parts.push(`${SEASON_NAME} OPR ${fixed(stats.opr)}${rank}.`);
	}
	if (stats.record && stats.events > 0) {
		const { wins, losses, ties } = stats.record;
		const events = stats.events === 1 ? '1 event' : `${stats.events} events`;
		parts.push(`Record ${wins}-${losses}-${ties} across ${events}.`);
	}
	parts.push('Match history, OPR by part and awards.');
	return parts.join(' ');
}

export function teamJsonLd(origin: string, team: SeoTeam): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'SportsTeam',
		name: `${team.number} ${team.name}`,
		alternateName: `FTC ${team.number}`,
		sport: 'Robotics',
		url: `${origin}/teams/${team.number}`,
		...(team.place ? { location: { '@type': 'Place', name: team.place } } : {}),
		...(team.rookieYear ? { foundingDate: String(team.rookieYear) } : {}),
		memberOf: {
			'@type': 'SportsOrganization',
			name: 'FIRST Tech Challenge',
			url: 'https://www.firstinspires.org/robotics/ftc'
		}
	};
}

const STATUS_TEXT: Record<EventStatusWord, string> = {
	upcoming: 'Upcoming.',
	live: 'Happening now, with live rankings and results.',
	done: 'Final results.'
};

export function eventDescription(event: Event, status: EventStatusWord, topic: string): string {
	return `${event.name}: ${eventMeta(event)} ${STATUS_TEXT[status]} ${topic}`;
}

export function eventJsonLd(origin: string, event: Event): JsonLd {
	const address = {
		'@type': 'PostalAddress',
		...(event.address ? { streetAddress: event.address } : {}),
		...(event.city ? { addressLocality: event.city } : {}),
		...(event.state ? { addressRegion: event.state } : {}),
		...(event.country ? { addressCountry: event.country } : {})
	};
	const place = {
		'@type': 'Place',
		name: event.venue ?? [event.city, event.state, event.country].filter(Boolean).join(', '),
		address
	};
	return {
		'@context': 'https://schema.org',
		'@type': 'SportsEvent',
		name: event.name,
		sport: 'Robotics',
		startDate: event.start,
		endDate: event.end,
		eventStatus: 'https://schema.org/EventScheduled',
		eventAttendanceMode: event.remote
			? 'https://schema.org/OnlineEventAttendanceMode'
			: 'https://schema.org/OfflineEventAttendanceMode',
		location: event.remote
			? { '@type': 'VirtualLocation', url: `${origin}/events/${event.code}` }
			: place,
		url: `${origin}/events/${event.code}`,
		organizer: {
			'@type': 'Organization',
			name: 'FIRST',
			url: 'https://www.firstinspires.org'
		}
	};
}

function teamList(match: Match, color: 'red' | 'blue'): string {
	const teams = match[color].map((entry) => entry.team);
	return teams.length > 1 ? `${teams.slice(0, -1).join(', ')} and ${teams.at(-1)}` : teams.join('');
}

export function matchDescription(match: Match, title: string, event: Event): string {
	const red = `red (${teamList(match, 'red')})`;
	const blue = `blue (${teamList(match, 'blue')})`;
	const head = `${title} at ${event.name}`;
	const result = match.result;
	if (!result)
		return `${head}: ${red} against ${blue}. Predicted score, win chances and team stats.`;
	const score = `${result.red.total}–${result.blue.total}`;
	const outcome =
		result.winner === 'red'
			? `${red} beat ${blue}, ${score}`
			: result.winner === 'blue'
				? `${blue} beat ${red}, ${result.blue.total}–${result.red.total}`
				: `${red} tied ${blue}, ${score}`;
	return `${head}: ${outcome}. Score breakdown, predictions and team stats.`;
}
