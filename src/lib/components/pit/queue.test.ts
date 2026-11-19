import { describe, expect, it } from 'vitest';
import { replayBundle, replayStart } from '#lib/game/replay.ts';
import type { QueueStatusSnapshot } from '#lib/types.ts';
import { fixtureBundle } from './fixtures.ts';
import { QUEUE_EARLIEST, queueCall, showTakeover } from './queue.ts';
import { pitView, type NextMatch } from './view.ts';

const full = fixtureBundle('USAZGIQ');
const at = (label: string) => replayStart(label, full)!;
const nextAt = (time: number, queue: QueueStatusSnapshot | null = null) =>
	pitView({ bundle: replayBundle(full, time), analysis: null, queue, team: 14624 }).next!;
const q23Start = full.matches.find((match) => match.key === 'q23')!.actualTime!;
const q26 = full.matches.find((match) => match.key === 'q26')!;

function nexus(status: QueueStatusSnapshot['matches'][number]['status']): QueueStatusSnapshot {
	return {
		eventKey: '2026usazgiq',
		dataAsOfTime: 0,
		nowQueuing: null,
		announcements: [],
		matches: [
			{
				label: 'Qualification 26',
				key: 'q26',
				status,
				red: [25620, 14624],
				blue: [32043, 22258],
				times: {
					scheduledStart: null,
					estimatedQueue: null,
					estimatedOnDeck: null,
					estimatedOnField: null,
					estimatedStart: null,
					actualQueue: null,
					actualOnDeck: null,
					actualOnField: null,
					actualStart: null,
					actualCommit: null
				},
				breakAfter: null,
				replayOf: null
			}
		]
	};
}

describe('queueCall', () => {
	it('waits until two matches before ours without a model or Nexus', () => {
		expect(queueCall(nextAt(at('Q22')), at('Q22'))).toBeNull();
		expect(queueCall(nextAt(q23Start), q23Start)).toEqual({
			key: 'q26',
			label: 'Q26',
			alliance: 'red',
			reason: 'schedule'
		});
	});

	it('does not call a match far in the future even if it is close in order', () => {
		const next: NextMatch = { ...nextAt(q23Start), matchesAway: 1 };
		const early = q26.scheduledTime! - QUEUE_EARLIEST - 60_000;
		expect(queueCall(next, early)).toBeNull();
		expect(queueCall(next, q26.scheduledTime! - QUEUE_EARLIEST)).not.toBeNull();
	});

	it('uses the queue time from the model when there is one', () => {
		const next: NextMatch = { ...nextAt(at('Q22')), queueAt: at('Q22') + 120_000 };
		expect(queueCall(next, at('Q22') + 119_000)).toBeNull();
		expect(queueCall(next, at('Q22') + 120_000)?.reason).toBe('timing');
	});

	it('follows Nexus when the event uses it', () => {
		expect(nextAt(at('Q22'), nexus('queuing-soon')).nexus).toEqual({
			tracked: true,
			status: 'queuing-soon'
		});
		expect(queueCall(nextAt(q23Start, nexus('queuing-soon')), q23Start)).toBeNull();
		for (const status of ['now-queuing', 'on-deck', 'on-field'] as const) {
			expect(queueCall(nextAt(at('Q22'), nexus(status)), at('Q22'))?.reason).toBe('nexus');
		}
		const snapshot = { ...nexus(null), nowQueuing: 'Qualification 26' };
		expect(queueCall(nextAt(at('Q22'), snapshot), at('Q22'))?.reason).toBe('nexus');
	});

	it('stops once the match starts and stays closed after a tap', () => {
		const started = q26.actualTime!;
		expect(queueCall(nextAt(started), started)).toBeNull();
		expect(queueCall(null, started)).toBeNull();
		const call = queueCall(nextAt(q23Start), q23Start);
		expect(showTakeover(call, null)).toBe(true);
		expect(showTakeover(call, 'q26')).toBe(false);
		expect(showTakeover(call, 'q17')).toBe(true);
		expect(showTakeover(null, null)).toBe(false);
	});
});
