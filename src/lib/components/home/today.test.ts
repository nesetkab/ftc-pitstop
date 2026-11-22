import { describe, expect, it } from 'vitest';
import { match, ranking } from '#lib/components/team/fixtures.ts';
import type { Match, SeasonMatch } from '#lib/types.ts';
import { compareToday, eventProgress, seasonProgress, todayState } from './today.ts';

const NOW = Date.parse('2026-11-14T20:00:00Z');
const event = { type: 'Qualifier' as const, end: '2026-11-14', timezone: 'America/Phoenix' };
const later = Date.parse('2026-11-15T13:00:00Z');

function quals(total: number, played: number): Match[] {
	return Array.from({ length: total }, (_, index) =>
		match(
			index + 1,
			[index + 100, index + 200],
			[index + 300, index + 400],
			'2026-11-14T17:00:00Z',
			index < played
		)
	);
}

function playoff(number: number, played: boolean): Match {
	return {
		...match(number, [1, 2], [3, 4], '2026-11-14T22:00:00Z', played),
		key: `p${number}`,
		level: 'playoff',
		series: number,
		label: `M${number}`
	};
}

const rankings = [ranking(2, 20, 3, 1), { ...ranking(1, 10, 4, 0), name: 'Top Team' }];

describe('eventProgress', () => {
	it('knows nothing without a schedule or rankings', () => {
		expect(eventProgress({ event, matches: [], rankings: [], now: NOW, endsAt: later })).toBeNull();
	});

	it('shows the last played qual and the leader during quals', () => {
		expect(
			eventProgress({ event, matches: quals(40, 23), rankings, now: NOW, endsAt: later })
		).toEqual({ phase: 'quals', label: 'Q23 of 40', leader: { team: 10, name: 'Top Team' } });
	});

	it('says how many quals are scheduled before the first one is played', () => {
		expect(
			eventProgress({ event, matches: quals(30, 0), rankings: [], now: NOW, endsAt: later })
		).toMatchObject({ phase: 'upcoming', label: '30 quals scheduled', leader: null });
	});

	it('moves to alliance selection, playoffs and done', () => {
		const done = quals(10, 10);
		expect(eventProgress({ event, matches: done, rankings, now: NOW, endsAt: later })?.label).toBe(
			'Alliance selection'
		);
		expect(
			eventProgress({
				event,
				matches: [...done, playoff(1, true), playoff(2, false)],
				rankings,
				now: NOW,
				endsAt: later
			})?.label
		).toBe('Playoffs');
		expect(
			eventProgress({ event, matches: done, rankings, now: later + 1, endsAt: later })?.label
		).toBe('Done');
	});
});

describe('seasonProgress', () => {
	const played = (level: 'qual' | 'playoff', number: number) => ({ level, number }) as SeasonMatch;

	it('counts played quals from season results', () => {
		expect(seasonProgress([played('qual', 3), played('qual', 8)])).toEqual({
			phase: 'quals',
			label: 'Q8 played',
			leader: null
		});
	});

	it('notices playoffs and empty events', () => {
		expect(seasonProgress([played('qual', 8), played('playoff', 1)])?.label).toBe('Playoffs');
		expect(seasonProgress([])).toBeNull();
	});
});

describe('today ordering', () => {
	it('puts live events first, then posted, waiting and done', () => {
		const rows = [
			{ name: 'B', state: todayState({ phase: 'done', label: 'Done', leader: null }, true) },
			{ name: 'C', state: todayState(null, false) },
			{ name: 'D', state: todayState(null, true) },
			{ name: 'A', state: todayState({ phase: 'playoffs', label: 'Playoffs', leader: null }, true) }
		];
		expect(rows.sort(compareToday).map((row) => [row.name, row.state])).toEqual([
			['A', 'live'],
			['D', 'posted'],
			['C', 'waiting'],
			['B', 'done']
		]);
	});
});
