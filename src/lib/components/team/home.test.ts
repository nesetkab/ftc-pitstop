import { describe, expect, it } from 'vitest';
import { eventSummary } from './fixtures.ts';
import { buildHomeEvents } from './home.ts';

const NOW = Date.parse('2026-11-14T20:00:00Z');

describe('buildHomeEvents', () => {
	it('lists events running today with day and status text', () => {
		const { today } = buildHomeEvents(
			{
				today: [
					eventSummary({ code: 'B', name: 'Boise Qualifier', hasMatches: false }),
					eventSummary({
						code: 'A',
						name: 'Austin Qualifier',
						start: '2026-11-13',
						end: '2026-11-14'
					})
				],
				season: null
			},
			NOW
		);
		expect(today).toEqual([
			{
				code: 'A',
				name: 'Austin Qualifier',
				type: 'Qualifier',
				place: 'Gilbert, AZ',
				dates: 'Day 2 of 2',
				status: 'Matches posted'
			},
			{
				code: 'B',
				name: 'Boise Qualifier',
				type: 'Qualifier',
				place: 'Gilbert, AZ',
				dates: 'Today',
				status: 'No matches posted'
			}
		]);
	});

	it('puts events with matches first and then sorts by name', () => {
		const { today } = buildHomeEvents(
			{
				today: [
					eventSummary({ code: 'C', name: 'Cedar Meet', hasMatches: false }),
					eventSummary({ code: 'Z', name: 'Zeta Meet', hasMatches: true }),
					eventSummary({ code: 'A', name: 'Alpha Meet', hasMatches: true })
				],
				season: null
			},
			NOW
		);
		expect(today?.map((event) => event.code)).toEqual(['A', 'Z', 'C']);
	});

	it('leaves out kickoffs, workshops and other non-competition events', () => {
		const { today } = buildHomeEvents(
			{
				today: [
					eventSummary({ code: 'K', type: 'Kickoff', typeName: 'Kickoff' }),
					eventSummary({ code: 'Q' })
				],
				season: null
			},
			NOW
		);
		expect(today?.map((event) => event.code)).toEqual(['Q']);
	});

	it('lists events starting in the next seven days in date order', () => {
		const { week } = buildHomeEvents(
			{
				today: null,
				season: [
					eventSummary({ code: 'LATE', name: 'Late', start: '2026-11-21', end: '2026-11-22' }),
					eventSummary({ code: 'SOON', name: 'Soon', start: '2026-11-15', end: '2026-11-15' }),
					eventSummary({ code: 'FAR', name: 'Far', start: '2026-11-22', end: '2026-11-22' }),
					eventSummary({ code: 'NOW', name: 'Now', start: '2026-11-14', end: '2026-11-14' }),
					eventSummary({ code: 'GONE', name: 'Gone', start: '2026-11-10', end: '2026-11-11' })
				]
			},
			NOW
		);
		expect(week).toEqual([
			{
				code: 'SOON',
				name: 'Soon',
				type: 'Qualifier',
				place: 'Gilbert, AZ',
				dates: 'Nov 15',
				status: 'Tomorrow'
			},
			{
				code: 'LATE',
				name: 'Late',
				type: 'Qualifier',
				place: 'Gilbert, AZ',
				dates: 'Nov 21 and 22',
				status: 'In 7 days'
			}
		]);
	});

	it('uses each event time zone to decide what day it is', () => {
		const late = Date.parse('2026-11-15T03:00:00Z');
		const { today, week } = buildHomeEvents(
			{
				today: [eventSummary({ code: 'PHX', start: '2026-11-14', end: '2026-11-14' })],
				season: [
					eventSummary({ code: 'PHX2', start: '2026-11-15', end: '2026-11-15' }),
					eventSummary({
						code: 'SHA',
						start: '2026-11-15',
						end: '2026-11-15',
						timezone: 'Asia/Shanghai'
					})
				]
			},
			late
		);
		expect(today?.[0].dates).toBe('Today');
		expect(week?.map((event) => event.code)).toEqual(['PHX2']);
	});

	it('reports a list that could not be loaded as null', () => {
		expect(buildHomeEvents({ today: null, season: null }, NOW)).toEqual({
			today: null,
			week: null
		});
	});
});
