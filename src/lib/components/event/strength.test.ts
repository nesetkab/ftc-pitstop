import { describe, expect, it } from 'vitest';
import type { SeasonRatings } from '#lib/analysis/types.ts';
import type { EventSummary } from '#lib/types.ts';
import { listed, packEvents, unpackEvents } from './event-list.ts';
import {
	buildStrengthIndex,
	eventRank,
	filterStrength,
	measure,
	rankStrength,
	rosterFor,
	strengthDetail,
	strengthLine,
	strengthRows,
	type StrengthFilters
} from './strength.ts';

const NOW = Date.parse('2026-11-19T18:00:00Z');

function summary(code: string, start: string, extra: Partial<EventSummary> = {}): EventSummary {
	return {
		code,
		name: `${code} Qualifier`,
		type: 'Qualifier',
		typeName: 'Qualifier',
		region: 'USAZ',
		league: null,
		venue: null,
		city: 'Gilbert',
		state: 'AZ',
		country: 'USA',
		timezone: 'America/Phoenix',
		start,
		end: start,
		hasMatches: null,
		...extra
	};
}

function ratings(oprs: Record<number, number>, unplayed: number[] = []): SeasonRatings {
	const rated = Object.entries(oprs).map(([team, opr]) => ({
		team: Number(team),
		opr,
		matches: 5
	}));
	const idle = unplayed.map((team) => ({ team, opr: 0, matches: 0 }));
	return {
		generatedAt: 1000,
		teams: [...rated, ...idle].map((entry, at) => ({
			...entry,
			parts: {} as never,
			events: 1,
			rank: at + 1,
			percentile: 50,
			region: 'USAZ'
		}))
	};
}

const range = (from: number, count: number) => Array.from({ length: count }, (_, at) => from + at);

const oprs = new Map(range(1, 30).map((team) => [team, team]));

describe('measuring one event', () => {
	it('averages the 8 and 24 best rated teams and the whole rated field', () => {
		expect(measure(range(1, 30), oprs)).toEqual([26.5, 18.5, 15.5, 30, 30]);
	});

	it('needs 8 rated teams for a strength and 24 for the deeper average', () => {
		expect(measure(range(1, 10), oprs)).toEqual([6.5, null, 5.5, 10, 10]);
		expect(measure([1, 2, 3, 999], oprs)).toEqual([null, null, 2, 3, 4]);
		expect(measure([998, 999], oprs)).toBeNull();
	});

	it('counts each team once', () => {
		expect(measure([...range(21, 8), 28, 28], oprs)).toEqual([24.5, null, 24.5, 8, 8]);
	});
});

describe('which teams count', () => {
	const roster = { registered: [1, 2, 3, 4], played: [1, 3] };
	const event = { end: '2026-11-14', timezone: 'America/Phoenix' };

	it('uses teams that played once an event is over', () => {
		expect(rosterFor(event, roster, NOW)).toEqual([1, 3]);
	});

	it('uses registered teams before and during an event, or when nobody has results', () => {
		expect(rosterFor({ ...event, end: '2026-11-19' }, roster, NOW)).toEqual([1, 2, 3, 4]);
		expect(rosterFor(event, { ...roster, played: [] }, NOW)).toEqual([1, 2, 3, 4]);
		expect(rosterFor(event, undefined, NOW)).toEqual([]);
	});
});

describe('the season index', () => {
	const events = [
		summary('PAST', '2026-11-14'),
		summary('SOON', '2026-11-28', { region: 'USMT', type: 'LeagueMeet' }),
		summary('TINY', '2026-11-28'),
		summary('TIED', '2026-11-07')
	];
	const index = buildStrengthIndex({
		events,
		rosters: {
			PAST: { registered: range(1, 20), played: range(11, 10) },
			SOON: { registered: [...range(1, 26), 500], played: [] },
			TINY: { registered: [29, 30, 501], played: [] },
			TIED: { registered: range(11, 10), played: range(11, 10) }
		},
		ratings: ratings(Object.fromEntries(oprs), [500]),
		now: NOW
	});
	const ranked = rankStrength(index);

	it('stores one compact entry per event with any rated team', () => {
		expect(index.ratingsAt).toBe(1000);
		expect(index.events).toEqual({
			PAST: [16.5, null, 15.5, 10, 10],
			SOON: [22.5, 14.5, 13.5, 26, 27],
			TINY: [null, null, 29.5, 2, 3],
			TIED: [16.5, null, 15.5, 10, 10]
		});
	});

	it('ranks events with a strength, sharing a rank on ties', () => {
		expect(ranked.total).toBe(3);
		expect(eventRank(ranked, 'SOON')).toEqual({ rank: 1, top: 22.5, total: 3 });
		expect(eventRank(ranked, 'PAST')?.rank).toBe(2);
		expect(eventRank(ranked, 'TIED')?.rank).toBe(2);
		expect(eventRank(ranked, 'TINY')).toBeNull();
		expect(eventRank(ranked, 'NOPE')).toBeNull();
		expect(eventRank(null, 'SOON')).toBeNull();
	});

	it('describes an event in one line', () => {
		expect(strengthLine({ rank: 12, top: 64.24, total: 390 })).toBe(
			'12th of 390 events this season, with a top-8 average aOPR of 64.2'
		);
	});

	describe('filtering the ranking', () => {
		const shown = events.filter((event) => ranked.events.get(event.code)?.top != null);
		const packed = packEvents(
			shown.map((event) => {
				const entry = ranked.events.get(event.code)!;
				return listed(event, entry.teams, entry.top);
			})
		);
		const rows = strengthRows(
			unpackEvents(JSON.parse(JSON.stringify(packed))),
			shown.map((event) => strengthDetail(ranked.events.get(event.code)!))
		);
		const codes = (filters: Partial<StrengthFilters>) =>
			filterStrength(rows, { region: '', type: '', when: 'all', by: 'top', ...filters }, NOW).map(
				(row) => row.code
			);

		it('ranks strongest first and breaks ties by name', () => {
			expect(codes({})).toEqual(['SOON', 'PAST', 'TIED']);
		});

		it('filters by region, type and dates', () => {
			expect(codes({ region: 'USAZ' })).toEqual(['PAST', 'TIED']);
			expect(codes({ type: 'LeagueMeet' })).toEqual(['SOON']);
			expect(codes({ when: 'upcoming' })).toEqual(['SOON']);
			expect(codes({ when: 'past' })).toEqual(['PAST', 'TIED']);
		});

		it('ranks by the deeper average only where it exists', () => {
			expect(codes({ by: 'deep' })).toEqual(['SOON']);
			expect(codes({ by: 'all' })).toEqual(['PAST', 'TIED', 'SOON']);
		});

		it('keeps the detail for each row', () => {
			expect(rows.find((row) => row.code === 'SOON')).toMatchObject({
				top: 22.5,
				deep: 14.5,
				all: 13.5,
				rated: 26,
				teams: 27
			});
		});
	});
});
