import type { Award, EventType } from '#lib/types.ts';

const INSPIRE = 11;
const WINNING_ALLIANCE = 13;

const BANNER_EVENTS: ReadonlySet<EventType> = new Set(['Championship', 'FIRSTChampionship']);

export function isBanner(award: Pick<Award, 'id' | 'placement'>, type: EventType): boolean {
	if (!BANNER_EVENTS.has(type)) return false;
	return award.id === WINNING_ALLIANCE || (award.id === INSPIRE && award.placement === 1);
}

export function bannerLabel(award: Pick<Award, 'id'>): string {
	return award.id === WINNING_ALLIANCE ? 'Winner' : 'Inspire Award';
}

export function seasonYears(season: number): string {
	return `${season}-${String((season + 1) % 100).padStart(2, '0')}`;
}
