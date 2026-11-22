import { integer } from '#lib/format/number.ts';
import { dateRange } from '#lib/format/time.ts';
import type { Event, EventType } from '#lib/types.ts';
import { placeName } from '#lib/format/places.ts';

export const TYPE_LABELS: Record<EventType, string> = {
	Qualifier: 'Qualifier',
	LeagueMeet: 'League meet',
	LeagueTournament: 'League tournament',
	Championship: 'Championship',
	SuperQualifier: 'Super qualifier',
	FIRSTChampionship: 'FIRST Championship',
	Premier: 'Premier',
	NonAdvancement: 'Non-advancement',
	Scrimmage: 'Scrimmage',
	OffSeason: 'Off-season',
	Kickoff: 'Kickoff',
	Workshop: 'Workshop',
	DemoExhibition: 'Demo',
	VolunteerSignup: 'Volunteer signup',
	PracticeDay: 'Practice day',
	InnovationChallenge: 'Innovation challenge',
	Pilot: 'Pilot',
	Other: 'Other'
};

const NOUNS: Partial<Record<EventType, string>> = {
	NonAdvancement: 'Non-advancement event',
	OffSeason: 'Off-season event',
	Premier: 'Premier event',
	Pilot: 'Pilot event',
	Other: 'Event'
};

export const TYPE_ORDER = Object.keys(TYPE_LABELS) as EventType[];

export function typeLabel(type: EventType): string {
	return TYPE_LABELS[type] ?? 'Other';
}

export function typeNoun(type: EventType): string {
	return NOUNS[type] ?? typeLabel(type);
}

type MetaEvent = Pick<
	Event,
	'type' | 'venue' | 'city' | 'state' | 'country' | 'start' | 'end' | 'remote'
>;

export function eventMeta(event: MetaEvent, teamCount?: number | null): string {
	const noun = typeNoun(event.type);
	const place = placeName(event);
	let where = noun;
	if (event.remote) where = `Remote ${noun.toLowerCase()}`;
	else if (event.venue && place) where = `${noun} at ${event.venue}, ${place}`;
	else if (event.venue) where = `${noun} at ${event.venue}`;
	else if (place) where = `${noun} in ${place}`;
	const parts = [`${where}.`, `${dateRange(event.start, event.end)}.`];
	if (teamCount) parts.push(`${integer(teamCount)} ${teamCount === 1 ? 'team' : 'teams'}.`);
	return parts.join(' ');
}
