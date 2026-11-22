import { knownRegion, stateName } from '#lib/format/places.ts';
import type { EventSummary, SearchIndex, SearchTeam } from '#lib/types.ts';

export interface TeamStanding {
	opr: number;
	rank: number;
}

export type TeamHit = SearchTeam & { opr?: number; rank?: number };

export interface SearchResults {
	teams: TeamHit[];
	events: EventSummary[];
	lead?: 'teams' | 'events';
}

export interface SearchOptions {
	now?: number;
	standings?: ReadonlyMap<number, TeamStanding>;
}

interface Field {
	text: string;
	compact: string;
	tokens: string[];
}

interface PreparedTeam {
	team: SearchTeam;
	number: string;
	name: Field;
	place: Field;
}

interface PreparedEvent {
	event: EventSummary;
	code: string;
	name: Field;
	place: Field;
	start: number;
	end: number;
}

interface Match {
	score: number;
	typo: boolean;
}

const MISS: Match = { score: 0, typo: false };

interface Query {
	text: string;
	compact: string;
	tokens: string[];
}

const DAY = 86_400_000;
const PLACE_WEIGHT = 0.7;

const preparedTeams = new WeakMap<readonly SearchTeam[], PreparedTeam[]>();
const preparedEvents = new WeakMap<readonly EventSummary[], PreparedEvent[]>();

export function normalize(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function field(text: string): Field {
	const tokens = text ? text.split(' ') : [];
	return { text, compact: tokens.join(''), tokens };
}

function joined(parts: (string | null | undefined)[]): string {
	return parts.filter(Boolean).join(' ');
}

export function editDistance(a: string, b: string, limit: number): number {
	if (Math.abs(a.length - b.length) > limit) return limit + 1;
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		let best = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
			best = Math.min(best, current[j]);
		}
		if (best > limit) return limit + 1;
		previous = current;
	}
	return previous[b.length];
}

function typoLimit(token: string): number {
	if (/^\d+$/.test(token)) return 0;
	if (token.length >= 8) return 2;
	if (token.length >= 4) return 1;
	return 0;
}

function tokenScore(needle: string, token: string, last: boolean, typos: boolean): number {
	if (token === needle) return 1;
	const numeric = /^\d+$/.test(needle);
	if (numeric) return 0;
	if (token.startsWith(needle)) return needle.length >= 2 || last ? 0.85 : 0;
	if (needle.length >= 3 && token.includes(needle)) return 0.45;
	const limit = typos ? typoLimit(needle) : 0;
	if (limit > 0) {
		if (editDistance(needle, token, limit) <= limit) return 0.6;
		if (last && token.length > needle.length) {
			if (editDistance(needle, token.slice(0, needle.length), limit) <= limit) return 0.55;
		}
	}
	return 0;
}

function bestToken(needle: string, tokens: string[], last: boolean, typos: boolean): number {
	let best = 0;
	for (const token of tokens) {
		const score = tokenScore(needle, token, last, typos);
		if (score > best) best = score;
		if (best === 1) break;
	}
	return best;
}

function phraseScore(name: Field, query: Query): number {
	if (!name.text) return 0;
	if (name.text === query.text) return 1;
	if (name.text.startsWith(query.text)) return 0.97;
	if (query.compact.length >= 4) {
		if (name.compact === query.compact) return 0.96;
		if (name.compact.startsWith(query.compact)) return 0.93;
	}
	if (query.tokens.length > 1 && name.text.includes(` ${query.text}`)) return 0.92;
	if (query.compact.length >= 5 && name.compact.includes(query.compact)) return 0.7;
	return 0;
}

function wordsScore(name: Field, place: Field, query: Query, typos: boolean): number {
	let total = 0;
	for (const [i, needle] of query.tokens.entries()) {
		const last = i === query.tokens.length - 1;
		const best = Math.max(
			bestToken(needle, name.tokens, last, typos),
			bestToken(needle, place.tokens, last, typos) * PLACE_WEIGHT
		);
		if (best === 0) return 0;
		total += best;
	}
	return (0.95 * total) / query.tokens.length;
}

function textScore(name: Field, place: Field, query: Query): Match {
	const exact = Math.max(phraseScore(name, query), wordsScore(name, place, query, false));
	if (exact > 0) return { score: exact, typo: false };
	return { score: wordsScore(name, place, query, true), typo: true };
}

function prepareTeams(teams: readonly SearchTeam[]): PreparedTeam[] {
	let prepared = preparedTeams.get(teams);
	if (!prepared) {
		prepared = teams.map((team) => ({
			team,
			number: String(team.number),
			name: field(normalize(team.name)),
			place: field(
				normalize(
					joined([team.city, team.state, stateName(team.state, team.country), team.country])
				)
			)
		}));
		preparedTeams.set(teams, prepared);
	}
	return prepared;
}

function dayOf(date: string): number {
	const time = Date.parse(`${date}T12:00:00Z`);
	return Number.isFinite(time) ? time : 0;
}

function prepareEvents(events: readonly EventSummary[]): PreparedEvent[] {
	let prepared = preparedEvents.get(events);
	if (!prepared) {
		prepared = events.map((event) => ({
			event,
			code: event.code.toLowerCase(),
			name: field(normalize(event.name)),
			place: field(
				normalize(
					joined([
						event.venue,
						event.city,
						event.state,
						stateName(event.state, event.country),
						event.country,
						knownRegion(event.region),
						event.league
					])
				)
			),
			start: dayOf(event.start),
			end: dayOf(event.end)
		}));
		preparedEvents.set(events, prepared);
	}
	return prepared;
}

function standingBonus(standing: TeamStanding | undefined): number {
	return standing ? 2.5 / (1 + standing.rank / 100) : 0;
}

function teamScore(entry: PreparedTeam, query: Query, numeric: boolean): Match {
	if (numeric) {
		if (entry.number === query.text) return { score: 1000, typo: false };
		if (entry.number.startsWith(query.text)) {
			return { score: 500 - 20 * (entry.number.length - query.text.length), typo: false };
		}
		return MISS;
	}
	const match = textScore(entry.name, entry.place, query);
	return { score: 100 * match.score, typo: match.typo };
}

export function timeBoost(start: number, end: number, now: number): number {
	if (!start || !end) return 0;
	const today = Math.floor(now / DAY) * DAY + DAY / 2;
	if (today >= start - DAY / 2 && today <= end + DAY / 2) return 12;
	const days = today < start ? (start - today) / DAY : (today - end) / DAY;
	if (days <= 7) return today < start ? 9 : 7;
	if (today < start) return Math.max(2, 6 - days / 14);
	return Math.max(0, 3 - days / 30);
}

function eventScore(entry: PreparedEvent, query: Query, now: number): Match {
	if (entry.code === query.compact) return { score: 1000, typo: false };
	if (query.compact.length >= 4 && entry.code.startsWith(query.compact)) {
		return { score: 300 + timeBoost(entry.start, entry.end, now), typo: false };
	}
	const match = textScore(entry.name, entry.place, query);
	if (match.score === 0) return MISS;
	return { score: 100 * match.score + timeBoost(entry.start, entry.end, now), typo: match.typo };
}

function parse(input: string): Query {
	const text = normalize(input);
	const tokens = text ? text.split(' ') : [];
	return { text, tokens, compact: tokens.join('') };
}

export function standingsOf(
	ratings: { teams: { team: number; opr: number; rank: number; matches: number }[] } | null
): Map<number, TeamStanding> {
	const standings = new Map<number, TeamStanding>();
	for (const rating of ratings?.teams ?? []) {
		if (rating.matches > 0) standings.set(rating.team, { opr: rating.opr, rank: rating.rank });
	}
	return standings;
}

function ranked<T extends { match: Match }>(items: T[], strict: boolean): T[] {
	return items.filter(({ match }) => match.score > 0 && !(strict && match.typo));
}

export function search(
	index: Pick<SearchIndex, 'teams' | 'events'>,
	input: string,
	limit = 10,
	options: SearchOptions = {}
): SearchResults {
	const query = parse(input);
	if (!query.text) return { teams: [], events: [] };
	const now = options.now ?? Date.now();
	const standings = options.standings ?? new Map<number, TeamStanding>();
	const numeric = /^\d+$/.test(query.compact) && query.tokens.length === 1;
	const teamMatches = prepareTeams(index.teams).map((entry) => {
		const standing = standings.get(entry.team.number);
		const match = teamScore(entry, query, numeric);
		const bonus = match.score > 0 ? standingBonus(standing) : 0;
		return { entry, standing, match: { ...match, score: match.score + bonus } };
	});
	const eventMatches = prepareEvents(index.events).map((entry) => ({
		entry,
		match: eventScore(entry, query, now)
	}));
	const strict = [...teamMatches, ...eventMatches].some(
		({ match }) => match.score > 0 && !match.typo
	);
	const topTeams = ranked(teamMatches, strict)
		.sort((a, b) => b.match.score - a.match.score || a.entry.team.number - b.entry.team.number)
		.slice(0, limit);
	const teams = topTeams.map(({ entry, standing }): TeamHit =>
		standing ? { ...entry.team, opr: standing.opr, rank: standing.rank } : entry.team
	);
	const topEvents = ranked(eventMatches, strict)
		.sort(
			(a, b) =>
				b.match.score - a.match.score ||
				Math.abs(a.entry.start - now) - Math.abs(b.entry.start - now) ||
				a.entry.code.localeCompare(b.entry.code)
		)
		.slice(0, limit);
	const events = topEvents.map(({ entry }) => entry.event);
	const best = (list: { match: Match }[]) => list[0]?.match.score ?? 0;
	return { teams, events, lead: best(topEvents) > best(topTeams) ? 'events' : 'teams' };
}
