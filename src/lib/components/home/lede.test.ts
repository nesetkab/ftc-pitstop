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

const record = { alliance: 'blue' as const, redScore: 120, blueScore: 288 };

describe('home lede', () => {
	it('leads with live events', () => {
		expect(
			homeLede({ today: [today('A', 'live'), today('B', 'done')], week: [event('C')], record })
		).toEqual({
			lead: '1 event is running now.',
			rest: '1 event starts this week, and the world record is 288.'
		});
	});

	it('says when nothing runs today', () => {
		expect(homeLede({ today: [], week: [event('A'), event('B')], record: null })).toEqual({
			lead: 'No events are running today.',
			rest: '2 events start this week.'
		});
	});

	it('counts the day when nothing is live', () => {
		expect(homeLede({ today: [today('A', 'waiting')], week: [], record: null })).toEqual({
			lead: '1 event runs today.'
		});
	});

	it('says nothing when today could not be loaded', () => {
		expect(homeLede({ today: null, week: null, record })).toBeNull();
	});
});
