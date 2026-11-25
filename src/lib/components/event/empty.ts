import type { EventBundle } from '#lib/types.ts';
import type { EmptyAction } from '#lib/ui/EmptyState.svelte';

type Posted = Pick<EventBundle, 'phase' | 'matches' | 'rankings' | 'teams'>;

export function previewText(bundle: Pick<EventBundle, 'phase' | 'matches' | 'teams'>): string {
	const finished = bundle.phase === 'done';
	if (bundle.matches.length > 0) {
		return finished
			? 'No results were posted for this event.'
			: "Qualification matches haven't started yet.";
	}
	if (bundle.teams.length === 0) {
		return finished
			? 'No teams or matches were posted for this event.'
			: "The team list and match schedule haven't been posted yet.";
	}
	return scheduleText(bundle);
}

export function scheduleText(bundle: Pick<EventBundle, 'phase'>): string {
	return bundle.phase === 'done'
		? 'No match schedule was posted for this event.'
		: "The match schedule hasn't been posted yet.";
}

export function resultsText(bundle: Pick<EventBundle, 'phase'>): string {
	return bundle.phase === 'done'
		? 'No results were posted for this event.'
		: 'No matches have been played yet.';
}

export function teamsAction(bundle: Posted & { event: { code: string } }): EmptyAction | null {
	const tabs = bundle.matches.length > 0 || bundle.rankings.length > 0;
	if (tabs || bundle.teams.length === 0) return null;
	return { href: `/events/${bundle.event.code}`, label: 'See the teams' };
}
