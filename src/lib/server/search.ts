import type { EventSummary, SearchIndex, SearchTeam } from '#lib/types.ts';

export interface SearchResults {
	teams: SearchTeam[];
	events: EventSummary[];
}

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

function teamScore(team: SearchTeam, query: string, numeric: boolean): number {
	if (numeric) {
		const number = String(team.number);
		if (number === query) return 200;
		if (number.startsWith(query)) return 150 - number.length;
		return 0;
	}
	const name = textScore(normalize(team.name), query);
	const place = textScore(normalize([team.city, team.state].filter(Boolean).join(' ')), query);
	return Math.max(name, place * 0.5);
}

function eventScore(event: EventSummary, query: string): number {
	const code = event.code.toLowerCase();
	if (code === query.replace(/\s/g, '')) return 200;
	const fields = [
		textScore(code, query) * 1.2,
		textScore(normalize(event.name), query),
		textScore(
			normalize([event.city, event.state, event.country].filter(Boolean).join(' ')),
			query
		) * 0.5
	];
	return Math.max(...fields);
}

export function search(
	index: Pick<SearchIndex, 'teams' | 'events'>,
	input: string,
	limit = 10
): SearchResults {
	const query = normalize(input);
	if (!query) return { teams: [], events: [] };
	const numeric = /^\d+$/.test(query);
	const teams = index.teams
		.map((team) => ({ team, score: teamScore(team, query, numeric) }))
		.filter((entry) => entry.score > 0)
		.sort((a, b) => b.score - a.score || a.team.number - b.team.number)
		.slice(0, limit)
		.map((entry) => entry.team);
	const events = index.events
		.map((event) => ({ event, score: eventScore(event, query) }))
		.filter((entry) => entry.score > 0)
		.sort((a, b) => b.score - a.score || b.event.start.localeCompare(a.event.start))
		.slice(0, limit)
		.map((entry) => entry.event);
	return { teams, events };
}
