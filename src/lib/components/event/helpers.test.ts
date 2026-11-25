import { describe, expect, it } from 'vitest';
import type { Award, EventSummary } from '#lib/types.ts';
import { awardName, groupAwards, noAwardsText } from './awards.ts';
import { eventMeta } from './event-meta.ts';
import {
	filterEvents,
	firstPage,
	groupByWeek,
	listed,
	listStatus,
	packEvents,
	regionGroups,
	unpackEvents,
	windowCovers,
	type EventFilters
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
const events = season.map((event, at) => listed(event, 20, at === 2 ? 41.5 : null));

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
		const shown = (when: 'upcoming' | 'past') =>
			filterEvents(
				events,
				{ query: '', region: '', type: '', when },
				NOW,
				new Set(['LIVE', 'SOON'])
			).map((event) => `${event.code} ${event.status}`);
		expect(shown('upcoming')).toEqual(['SOON upcoming', 'LATER upcoming']);
		expect(shown('past')).toEqual(['LIVE done', 'PAST done']);
	});

	it('never calls an event live after its last day ends where it is held', () => {
		const tokyo = listed(
			summary('TOKYO', '2026-11-18', '2026-11-19', { timezone: 'Asia/Tokyo' }),
			20
		);
		const hawaii = listed(
			summary('HAWAII', '2026-11-18', '2026-11-19', { timezone: 'Pacific/Honolulu' }),
			20
		);
		const at = (iso: string) => Date.parse(iso);
		expect(listStatus(tokyo, at('2026-11-19T14:59:00Z'))).toBe('live');
		expect(listStatus(tokyo, at('2026-11-19T15:01:00Z'))).toBe('done');
		expect(listStatus(hawaii, at('2026-11-20T09:59:00Z'))).toBe('live');
		expect(listStatus(hawaii, at('2026-11-20T10:01:00Z'))).toBe('done');
		expect(listStatus(hawaii, at('2026-11-20T10:01:00Z'), new Set())).toBe('done');
		expect(listStatus(hawaii, at('2026-11-18T10:01:00Z'))).toBe('live');
		expect(listStatus(hawaii, at('2026-11-18T09:59:00Z'))).toBe('upcoming');
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
					{ value: 'USAZ', label: 'Arizona' },
					{ value: 'USMT', label: 'Montana' }
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
			'Butte, MT',
			4,
			'2026-11-21',
			1,
			20,
			41.5
		]);
		expect(unpackEvents(JSON.parse(JSON.stringify(packed)))).toEqual(events);
	});
});

describe('event list first page', () => {
	const later = [
		...events,
		listed(summary('LAST', '2026-12-12', '2026-12-12'), 20),
		listed(summary('TIED', '2026-12-05', '2026-12-05'), 20)
	];
	const upcoming: EventFilters = { query: '', region: '', type: '', when: 'upcoming' };
	const shown = (list: typeof later, filters: EventFilters, now = NOW) =>
		filterEvents(list, filters, now).map((event) => event.code);

	it('keeps this week and the first upcoming events, ties included', () => {
		const page = firstPage(later, NOW, new Set(), 3);
		expect(page.events.map((event) => event.code)).toEqual(['LIVE', 'SOON', 'LATER', 'TIED']);
		expect(page.window).toEqual({ from: '2026-11-16', to: '2026-11-22', upcoming: 5 });
		expect(shown(page.events, upcoming).slice(0, 3)).toEqual(shown(later, upcoming).slice(0, 3));
	});

	it('keeps every open event when the season has fewer than a page left', () => {
		const page = firstPage(later, NOW, new Set(), 50);
		expect(page.events.map((event) => event.code)).toEqual(
			later.filter((event) => event.code !== 'PAST').map((event) => event.code)
		);
		expect(windowCovers(page.window, upcoming, 50, 5, NOW)).toBe(true);
	});

	it('serves the default views from the first page and asks for the season otherwise', () => {
		const { events: kept, window } = firstPage(later, NOW, new Set(), 3);
		const covers = (filters: Partial<EventFilters>, limit = 3, now = NOW) => {
			const all = { ...upcoming, ...filters };
			return windowCovers(window, all, limit, shown(kept, all, now).length, now);
		};
		expect(covers({})).toBe(true);
		expect(covers({ when: 'week' })).toBe(true);
		expect(covers({}, 6)).toBe(false);
		expect(covers({ when: 'past' })).toBe(false);
		expect(covers({ when: 'all' })).toBe(false);
		expect(covers({ query: 'butte' })).toBe(false);
		expect(covers({ region: 'USMT' })).toBe(false);
		expect(covers({ type: 'LeagueMeet' })).toBe(false);
		expect(covers({ when: 'week' }, 3, Date.parse('2026-11-25T18:00:00Z'))).toBe(false);
	});

	it('asks for more once events on the first page have finished', () => {
		const { events: kept, window } = firstPage(later, NOW, new Set(), 3);
		const after = Date.parse('2026-11-24T18:00:00Z');
		const left = shown(kept, upcoming, after).length;
		expect(left).toBeLessThan(3);
		expect(windowCovers(window, upcoming, 3, left, after)).toBe(false);
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
		expect(byName.get('Winning alliance')).toEqual([
			{ label: 'Captain', team: 18420, person: null },
			{ label: '1st pick', team: 25620, person: null }
		]);
		expect(byName.get('Connect Award')).toEqual([{ label: null, team: 14254, person: null }]);
		expect(byName.get('Volunteer Award')).toEqual([
			{ label: null, team: null, person: 'Hunter Kotora' }
		]);
		expect(byName.has('FIRST Leadership Award Semi-Finalists')).toBe(false);
	});

	it('writes one display name for raw and split award names', () => {
		expect(awardName({ name: 'Inspire Award 2nd Place' })).toBe('Inspire Award 2nd place');
		expect(awardName({ name: 'Inspire Award', placement: 3 })).toBe('Inspire Award 3rd place');
		expect(awardName({ name: 'Think Award', placement: 1 })).toBe('Think Award');
		expect(awardName({ name: 'Winning Alliance - Captain' })).toBe('Winning alliance captain');
		expect(awardName({ name: 'Finalist Alliance - 1st Team Selected' })).toBe(
			'Finalist alliance 1st pick'
		);
		expect(awardName({ name: '<i>FIRST</i><sup>®</sup> Leadership Award Semi-Finalists' })).toBe(
			'FIRST Leadership Award Semi-Finalists'
		);
	});
});
