import type { AllianceColor } from '#lib/types.ts';
import type { NextMatch } from './view.ts';

export const QUEUE_MATCHES_AHEAD = 2;
export const QUEUE_EARLIEST = 20 * 60_000;

export type QueueReason = 'nexus' | 'timing' | 'schedule';

export interface QueueCall {
	key: string;
	label: string;
	alliance: AllianceColor;
	reason: QueueReason;
}

const CALLED = new Set(['now-queuing', 'on-deck', 'on-field']);

export function queueCall(next: NextMatch | null, now: number): QueueCall | null {
	if (!next || next.started !== null || next.outcome !== null) return null;
	const call = (reason: QueueReason): QueueCall => ({
		key: next.key,
		label: next.label,
		alliance: next.alliance,
		reason
	});
	if (next.nexus.tracked) {
		return next.nexus.status && CALLED.has(next.nexus.status) ? call('nexus') : null;
	}
	if (next.queueAt !== null) return now >= next.queueAt ? call('timing') : null;
	const close = next.scheduled === null || now >= next.scheduled - QUEUE_EARLIEST;
	return next.matchesAway <= QUEUE_MATCHES_AHEAD && close ? call('schedule') : null;
}

export function showTakeover(call: QueueCall | null, dismissed: string | null): boolean {
	return call !== null && call.key !== dismissed;
}
