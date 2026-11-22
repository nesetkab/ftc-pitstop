import { describe, expect, it } from 'vitest';
import type { Award, EventSummary } from '#lib/types.ts';
import { groupAwards, noAwardsText } from './awards.ts';
import { eventMeta } from './event-meta.ts';
import {
	filterEvents,
	groupByWeek,
	listed,
	packEvents,
	regionGroups,
	unpackEvents
} from './event-list.ts';
import { fixtureBundle } from './test-fixtures.ts';

const NOW = Date.parse('2026-11-19T18:00:00Z');

function summary(code: string, start: string, end: string, extra: Partial<EventSummary> = {}) {
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
		end,
		hasMatches: null,
		...extra
	} satisfies EventSummary;
}

const season = [
	summary('PAST', '2026-11-14', '2026-11-14'),
	summary('LIVE', '2026-11-19', '2026-11-19', { city: 'Tempe' }),
	summary('SOON', '2026-11-21', '2026-11-22', {
		region: 'USMT',
		city: 'Butte',
		state: 'MT',
		timezone: 'America/Denver'
	}),
	summary('LATER', '2026-12-05', '2026-12-05', { type: 'LeagueMeet', typeName: 'League Meet' })
];
const events = season.map((event) => listed(event, 20));

describe('event list', () => {
	it('filters by date, region, type and text', () => {
		const codes = (filters: Partial<Parameters<typeof filterEvents>[1]>) =>
			filterEvents(events, { query: '', region: '', type: '', when: 'all', ...filters }, NOW).map(
				(event) => `${event.code} ${event.status}`
			);
		expect(codes({ when: 'upcoming' })).toEqual(['LIVE live', 'SOON upcoming', 'LATER upcoming']);
		expect(codes({ when: 'week' })).toEqual(['LIVE live', 'SOON upcoming']);
		expect(codes({ when: 'past' })).toEqual(['PAST done']);
		expect(codes({ region: 'USMT' })).toEqual(['SOON upcoming']);
		expect(codes({ type: 'LeagueMeet' })).toEqual(['LATER upcoming']);
		expect(codes({ query: 'montana' })).toEqual(['SOON upcoming']);
		expect(codes({ query: 'tempe live' })).toEqual(['LIVE live']);
	});

	it('marks a live event done once it is known to be finished', () => {
		const shown = filterEvents(
			events,
			{ query: '', region: '', type: '', when: 'upcoming' },
			NOW,
			new Set(['LIVE', 'SOON'])
		);
		expect(shown.map((event) => `${event.code} ${event.status}`)).toEqual([
			'LIVE done',
			'SOON upcoming',
			'LATER upcoming'
		]);
	});

	it('groups by week and labels regions with real place names', () => {
		const groups = groupByWeek(
			filterEvents(events, { query: '', region: '', type: '', when: 'all' }, NOW),
			NOW
		);
		expect(groups.map((group) => [group.label, group.current, group.events.length])).toEqual([
			['November 9 to 15, 2026', false, 1],
			['November 16 to 22, 2026', true, 2],
			['November 30 to December 6, 2026', false, 1]
		]);
		expect(regionGroups(season)).toEqual([
			{
				label: 'United States',
				options: [
					{ value: 'USAZ', label: 'Arizona (USAZ)' },
					{ value: 'USMT', label: 'Montana (USMT)' }
				]
			}
		]);
	});
	it('packs events into a compact shape and back without losing anything', () => {
		const packed = packEvents(events);
		expect(packed.words).toEqual([
			'Qualifier',
			'USAZ',
			'America/Phoenix',
			'USMT',
			'America/Denver',
			'LeagueMeet'
		]);
		expect(packed.rows[2]).toEqual([
			'SOON',
			'SOON Qualifier',
			0,
			3,
			'Butte, Montana',
			4,
			'2026-11-21',
			1,
			20
		]);
		expect(unpackEvents(JSON.parse(JSON.stringify(packed)))).toEqual(events);
	});
});

describe('event meta', () => {
	it('writes the header sentence', () => {
		expect(eventMeta(fixtureBundle('USAZGIQ').event)).toBe(
			'Qualifier at Gilbert Christian High School, Gilbert, Arizona. Saturday, November 14, 2026.'
		);
		expect(eventMeta(fixtureBundle('USMTBUQ').event, 37)).toBe(
			'Qualifier at East Middle School, Butte, Montana. November 20 and 21, 2026. 37 teams.'
		);
		expect(eventMeta(fixtureBundle('UZTAQ1').event)).toBe(
			'Qualifier in Tashkent, Uzbekistan. November 14 to 16, 2026.'
		);
	});
});

describe('awards', () => {
	it('explains that league meets give no awards', () => {
		expect(noAwardsText('LeagueMeet').title).toBe("League meets don't give awards.");
		expect(noAwardsText('Qualifier').title).toBe('No awards yet.');
	});

	it('groups placements and alliance roles and skips awards not given', () => {
		const groups = groupAwards(fixtureBundle('USAZGIQ').awards as Award[]);
		const byName = new Map(groups.map((group) => [group.name, group.entries]));
		expect(byName.get('Inspire Award')).toEqual([
			{ label: '1st place', team: 25620, person: null },
			{ label: '2nd place', team: 18420, person: null },
			{ label: '3rd place', team: 2844, person: null }
		]);
		expect(byName.get('Winning Alliance')).toEqual([
			{ label: 'Captain', team: 18420, person: null },
			{ label: '1st Team Selected', team: 25620, person: null }
		]);
		expect(byName.get('Connect Award')).toEqual([{ label: null, team: 14254, person: null }]);
		expect(byName.get('Volunteer Award')).toEqual([
			{ label: null, team: null, person: 'Hunter Kotora' }
		]);
		expect(byName.has('FIRST® Leadership Award Semi-Finalists')).toBe(false);
	});
});
