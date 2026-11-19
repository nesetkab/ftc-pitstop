import { describe, expect, it } from 'vitest';
import { bracketDecided, detectPhase, type PhaseInput } from '#lib/game/phase.ts';
import { mapAlliances, mapAwards, mapEvent, mapMatches } from '#lib/server/ftc/mappers.ts';
import {
	ftcAlliancesResponse,
	ftcAwardsResponse,
	ftcEventsResponse,
	ftcScheduleResponse,
	ftcScoresResponse
} from '#lib/server/ftc/schemas.ts';
import { eventWindow } from '#lib/server/event.ts';
import type { Match } from '#lib/types.ts';
import { fixture } from './helpers.ts';

const HOUR = 3_600_000;

function load(code: string) {
	const event = mapEvent(ftcEventsResponse.parse(fixture(code, 'event')).events![0]);
	const matches = mapMatches({
		timezone: event.timezone,
		qualSchedule: ftcScheduleResponse.parse(fixture(code, 'schedule-qual')),
		playoffSchedule: ftcScheduleResponse.parse(fixture(code, 'schedule-playoff')),
		qualScores: ftcScoresResponse.parse(fixture(code, 'scores-qual')),
		playoffScores: ftcScoresResponse.parse(fixture(code, 'scores-playoff'))
	});
	return {
		event,
		matches,
		alliances: mapAlliances(ftcAlliancesResponse.parse(fixture(code, 'alliances'))),
		awards: mapAwards(ftcAwardsResponse.parse(fixture(code, 'awards'))),
		endsAt: eventWindow(event).endsAt
	};
}

function unplayed(match: Match): Match {
	return { ...match, result: null, actualTime: null, postedTime: null };
}

function playedUntil(matches: Match[], key: string | null): Match[] {
	const index = key === null ? -1 : matches.findIndex((match) => match.key === key);
	return matches.map((match, i) => (i <= index ? match : unplayed(match)));
}

function phaseAt(
	code: string,
	options: Partial<PhaseInput> & { until?: string | null; noPlayoffs?: boolean }
) {
	const data = load(code);
	let matches =
		options.until === undefined ? data.matches : playedUntil(data.matches, options.until);
	if (options.noPlayoffs) matches = matches.filter((match) => match.level === 'qual');
	const last = [...matches].reverse().find((match) => match.result);
	return detectPhase({
		event: data.event,
		matches,
		alliances: options.alliances ?? data.alliances,
		awards: options.awards ?? [],
		endsAt: data.endsAt,
		now: options.now ?? (last?.postedTime ?? Date.parse(`${data.event.start}T12:00:00Z`)) + 60_000
	});
}

describe('detectPhase', () => {
	it('is upcoming before anything is scheduled or played', () => {
		const data = load('USMTBUQ');
		const input = {
			event: data.event,
			matches: [],
			alliances: [],
			awards: [],
			endsAt: data.endsAt
		};
		expect(detectPhase({ ...input, now: Date.parse('2026-11-19T12:00:00Z') })).toBe('upcoming');
		expect(detectPhase({ ...input, now: data.endsAt! + HOUR })).toBe('done');
		const scheduled = load('USAZGIQ')
			.matches.filter((match) => match.level === 'qual')
			.map(unplayed);
		expect(
			detectPhase({ ...input, matches: scheduled, now: Date.parse('2026-11-14T16:00:00Z') })
		).toBe('upcoming');
		const started = scheduled.map((match, i) =>
			i === 0 ? { ...match, actualTime: Date.parse('2026-11-14T17:33:00Z') } : match
		);
		expect(
			detectPhase({ ...input, matches: started, now: Date.parse('2026-11-14T17:34:00Z') })
		).toBe('quals');
	});

	it('follows a qualifier through every phase', () => {
		expect(phaseAt('USAZGIQ', { until: 'q10', noPlayoffs: true, alliances: [] })).toBe('quals');
		expect(phaseAt('USAZGIQ', { until: 'q34', noPlayoffs: true, alliances: [] })).toBe('selection');
		expect(phaseAt('USAZGIQ', { until: 'q34', noPlayoffs: true })).toBe('selection');
		expect(phaseAt('USAZGIQ', { until: 'q34' })).toBe('playoffs');
		expect(phaseAt('USAZGIQ', { until: 'p5' })).toBe('playoffs');
		expect(phaseAt('USAZGIQ', { until: 'p9' })).toBe('playoffs');
		expect(phaseAt('USAZGIQ', { until: 'p10' })).toBe('done');
		expect(phaseAt('USAZGIQ', {})).toBe('done');
	});

	it('waits for a second final when the lower bracket wins the first', () => {
		expect(phaseAt('USMISOQ', { until: 'p10' })).toBe('playoffs');
		expect(phaseAt('USMISOQ', { until: 'p11' })).toBe('done');
	});

	it('handles 2 and 4 alliance brackets', () => {
		expect(phaseAt('USALATQ', { until: 'p1' })).toBe('playoffs');
		expect(phaseAt('USALATQ', { until: 'p2' })).toBe('done');
		expect(phaseAt('UZTAQ1', { until: 'p5' })).toBe('playoffs');
		expect(phaseAt('UZTAQ1', { until: 'p6' })).toBe('done');
		expect(phaseAt('KZASN2', {})).toBe('done');
	});

	it('treats the winning alliance award as the end', () => {
		const data = load('USAZGIQ');
		expect(phaseAt('USAZGIQ', { until: 'p5', awards: data.awards })).toBe('done');
	});

	it('ends events without playoffs once quals are done', () => {
		expect(phaseAt('USFLORM1', {})).toBe('done');
		expect(phaseAt('USFLORM1', { until: 'q20' })).toBe('quals');
		const scrimmage = load('USCALACAS1');
		const lastPosted = Math.max(...scrimmage.matches.map((match) => match.postedTime ?? 0));
		expect(phaseAt('USCALACAS1', { now: lastPosted + 30 * 60_000 })).toBe('selection');
		expect(phaseAt('USCALACAS1', { now: lastPosted + 3 * HOUR })).toBe('done');
	});

	it('calls an event done once its last day is over', () => {
		const data = load('USAZGIQ');
		expect(phaseAt('USAZGIQ', { until: 'q10', noPlayoffs: true, now: data.endsAt! + 1 })).toBe(
			'done'
		);
	});
});

describe('bracketDecided', () => {
	it('counts two losses as out', () => {
		const data = load('UZTAQ1');
		const playoffs = data.matches.filter((match) => match.level === 'playoff');
		expect(bracketDecided(playoffs, data.alliances)).toBe(true);
		expect(bracketDecided(playoffs.slice(0, -1), data.alliances)).toBe(false);
		expect(bracketDecided(playoffs, [])).toBe(true);
		expect(bracketDecided([], data.alliances)).toBe(false);
	});
});
