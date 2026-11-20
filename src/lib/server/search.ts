import type { EventSummary, SearchIndex, SearchTeam } from '#lib/types.ts';

export interface SearchResults {
	teams: SearchTeam[];
	events: EventSummary[];
}

interface PreparedTeam {
	team: SearchTeam;
	number: string;
	name: string;
	place: string;
}

interface PreparedEvent {
	event: EventSummary;
	code: string;
	name: string;
	place: string;
}

const preparedTeams = new WeakMap<readonly SearchTeam[], PreparedTeam[]>();
const preparedEvents = new WeakMap<readonly EventSummary[], PreparedEvent[]>();

function normalize(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function textScore(haystack: string, needle: string): number {
	if (haystack === needle) return 100;
	if (haystack.startsWith(needle)) return 80;
	if (haystack.includes(` ${needle}`)) return 60;
	if (haystack.includes(needle)) return 40;
	return 0;
}

function prepareTeams(teams: readonly SearchTeam[]): PreparedTeam[] {
	let prepared = preparedTeams.get(teams);
	if (!prepared) {
		prepared = teams.map((team) => ({
			team,
			number: String(team.number),
			name: normalize(team.name),
			place: normalize([team.city, team.state].filter(Boolean).join(' '))
		}));
		preparedTeams.set(teams, prepared);
	}
	return prepared;
}

function prepareEvents(events: readonly EventSummary[]): PreparedEvent[] {
	let prepared = preparedEvents.get(events);
	if (!prepared) {
		prepared = events.map((event) => ({
			event,
			code: event.code.toLowerCase(),
			name: normalize(event.name),
			place: normalize([event.city, event.state, event.country].filter(Boolean).join(' '))
		}));
		preparedEvents.set(events, prepared);
	}
	return prepared;
}

function teamScore(entry: PreparedTeam, query: string, numeric: boolean): number {
	if (numeric) {
		if (entry.number === query) return 200;
		if (entry.number.startsWith(query)) return 150 - entry.number.length;
		return 0;
	}
	return Math.max(textScore(entry.name, query), textScore(entry.place, query) * 0.5);
}

function eventScore(entry: PreparedEvent, query: string): number {
	if (entry.code === query.replace(/\s/g, '')) return 200;
	return Math.max(
		textScore(entry.code, query) * 1.2,
		textScore(entry.name, query),
		textScore(entry.place, query) * 0.5
	);
}

export function search(
	index: Pick<SearchIndex, 'teams' | 'events'>,
	input: string,
	limit = 10
): SearchResults {
	const query = normalize(input);
	if (!query) return { teams: [], events: [] };
	const numeric = /^\d+$/.test(query);
	const teams = prepareTeams(index.teams)
		.map((entry) => ({ entry, score: teamScore(entry, query, numeric) }))
		.filter((scored) => scored.score > 0)
		.sort((a, b) => b.score - a.score || a.entry.team.number - b.entry.team.number)
		.slice(0, limit)
		.map((scored) => scored.entry.team);
	const events = prepareEvents(index.events)
		.map((entry) => ({ entry, score: eventScore(entry, query) }))
		.filter((scored) => scored.score > 0)
		.sort((a, b) => b.score - a.score || b.entry.event.start.localeCompare(a.entry.event.start))
		.slice(0, limit)
		.map((scored) => scored.entry.event);
	return { teams, events };
}
