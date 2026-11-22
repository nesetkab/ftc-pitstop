import { eventStatus } from '#lib/components/event/dates.ts';
import { WINNER_AWARD_ID } from '#lib/game/phase.ts';
import type { EventBundle, EventPhase } from '#lib/types.ts';

export const BUNDLE_INTERVAL = 15_000;
export const QUEUE_INTERVAL = 10_000;
export const DONE_INTERVAL = 120_000;
export const QUIET_INTERVAL = 300_000;
export const MAX_BACKOFF = 120_000;
export const STALE_AFTER = 180_000;

const LIVE_PHASES = new Set<EventPhase>(['quals', 'selection', 'playoffs']);

export function retryDelay(base: number, failures: number, max = MAX_BACKOFF): number {
	if (failures <= 0) return base;
	return Math.min(max, base * 2 ** failures);
}

export function isStale(lastSuccess: number | null, now: number, after = STALE_AFTER): boolean {
	return lastSuccess !== null && now - lastSuccess > after;
}

export type Connection = 'connected' | 'retrying' | 'offline';

export function connection(failures: number, online: boolean): Connection {
	if (!online) return 'offline';
	return failures > 0 ? 'retrying' : 'connected';
}

export function bundleDelay(bundle: EventBundle | null, now: number): number | null {
	if (!bundle || LIVE_PHASES.has(bundle.phase)) return BUNDLE_INTERVAL;
	const today = eventStatus(bundle.event, now);
	if (bundle.phase === 'upcoming') return today === 'live' ? BUNDLE_INTERVAL : QUIET_INTERVAL;
	const awarded = bundle.awards.some((award) => award.id === WINNER_AWARD_ID);
	if (today === 'done') return awarded ? null : QUIET_INTERVAL;
	return awarded ? DONE_INTERVAL : BUNDLE_INTERVAL;
}

export function queueActive(bundle: EventBundle | null, now: number): boolean {
	return bundle !== null && bundle.phase !== 'done' && eventStatus(bundle.event, now) === 'live';
}
