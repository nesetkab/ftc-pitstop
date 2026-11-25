import { describe, expect, it } from 'vitest';
import type { HomeEvent, TodayEvent } from './home.ts';
import { homeLede } from './lede.ts';

const event = (code: string): HomeEvent => ({
	code,
	name: code,
	type: 'Qualifier',
	place: 'Utah',
	dates: 'Nov 25',
	status: ''
});

const today = (code: string, state: TodayEvent['state']): TodayEvent => ({
	...event(code),
	state,
	leader: null,
	leaderLabel: ''
});

describe('home lede', () => {
	it('leads with live events', () => {
		expect(
			homeLede({ today: [today('A', 'live'), today('B', 'done')], week: [event('C')] })
		).toEqual({
			lead: '1 event is running now.',
			rest: '1 event starts this week.'
		});
	});

	it('says when nothing runs today', () => {
		expect(homeLede({ today: [], week: [event('A'), event('B')] })).toEqual({
			lead: 'No events are running today.',
			rest: '2 events start this week.'
		});
	});

	it('counts the day when nothing is live', () => {
		expect(homeLede({ today: [today('A', 'waiting')], week: [] })).toEqual({
			lead: '1 event runs today.'
		});
	});

	it('says nothing when today could not be loaded', () => {
		expect(homeLede({ today: null, week: null })).toBeNull();
	});
});
