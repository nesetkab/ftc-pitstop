import type { EventType } from '#lib/types.ts';

export const EVENT_TYPE_NAMES: Record<EventType, string> = {
	NonAdvancement: 'Non-Advancement',
	Scrimmage: 'Scrimmage',
	LeagueMeet: 'League Meet',
	Qualifier: 'Qualifier',
	LeagueTournament: 'League Tournament',
	Championship: 'Championship',
	Other: 'Other',
	FIRSTChampionship: 'FIRST Championship',
	SuperQualifier: 'Super Qualifier',
	InnovationChallenge: 'Innovation Challenge',
	OffSeason: 'Off-Season',
	Kickoff: 'Kickoff',
	Workshop: 'Workshop',
	DemoExhibition: 'Demo / Exhibition',
	VolunteerSignup: 'Volunteer Signup',
	PracticeDay: 'Practice Day',
	Premier: 'Premier',
	Pilot: 'Pilot'
};

export const FTC_EVENT_TYPE_CODES: Record<string, EventType> = {
	'0': 'NonAdvancement',
	'1': 'LeagueMeet',
	'2': 'Qualifier',
	'3': 'LeagueTournament',
	'4': 'Championship',
	'5': 'Other',
	'6': 'FIRSTChampionship',
	'7': 'SuperQualifier',
	'8': 'InnovationChallenge',
	'10': 'OffSeason',
	'12': 'Kickoff',
	'13': 'Workshop',
	'14': 'DemoExhibition',
	'15': 'VolunteerSignup',
	'16': 'PracticeDay',
	'17': 'Premier',
	'18': 'Pilot'
};

const NON_COMPETITION: ReadonlySet<EventType> = new Set([
	'Kickoff',
	'Workshop',
	'DemoExhibition',
	'VolunteerSignup',
	'PracticeDay'
]);

export function isCompetition(type: EventType): boolean {
	return !NON_COMPETITION.has(type);
}

export function hasPlayoffs(type: EventType): boolean {
	return isCompetition(type) && type !== 'LeagueMeet';
}

export function eventTypeFromName(name: string | null | undefined): EventType {
	if (name && name in EVENT_TYPE_NAMES) return name as EventType;
	return 'Other';
}
