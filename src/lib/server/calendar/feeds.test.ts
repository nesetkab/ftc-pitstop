import { describe, expect, it } from 'vitest';
import { fixtureBundle } from '#lib/components/event/test-fixtures.ts';
import {
	eventCalendar,
	matchTimes,
	scheduleLikely,
	teamCalendar
} from '#lib/server/calendar/feeds.ts';
import { renderCalendar } from '#lib/server/calendar/ics.ts';
import type { EventBundle, Match, MatchTeam, TeamSeason } from '#lib/types.ts';

const ORIGIN = 'https://www.ftcpitstop.com';

function unfold(text: string): string[] {
	return text.replace(/\r\n /g, '').split('\r\n').filter(Boolean);
}

function blocks(text: string): string[][] {
	const lines = unfold(text);
	const found: string[][] = [];
	let current: string[] | null = null;
	for (const line of lines) {
		if (line === 'BEGIN:VEVENT') current = [];
		else if (line === 'END:VEVENT' && current) {
			found.push(current);
			current = null;
		} else current?.push(line);
	}
	return found;
}

function field(block: string[], name: string): string | undefined {
	return block.find((line) => line.startsWith(`${name}:`) || line.startsWith(`${name};`));
}

function slot(team: number, station: number): MatchTeam {
	return { team, station, surrogate: false, noShow: false, dq: false, onField: true };
}

function qual(number: number, local: string, red: number[], blue: number[], played = false): Match {
	const at = Date.parse(`${local}-08:00`);
	return {
		key: `q${number}`,
		level: 'qual',
		series: 0,
		number,
		label: `Q${number}`,
		description: `Qualification ${number}`,
		scheduledTime: at,
		actualTime: played ? at : null,
		postedTime: played ? at + 300_000 : null,
		red: red.map((team, index) => slot(team, index + 1)),
		blue: blue.map((team, index) => slot(team, index + 1)),
		result: played
			? {
					red: {
						total: 40,
						preFoulTotal: 40,
						auto: 10,
						teleop: 30,
						foulPoints: 0,
						breakdown: null
					},
					blue: {
						total: 30,
						preFoulTotal: 30,
						auto: 10,
						teleop: 20,
						foulPoints: 0,
						breakdown: null
					},
					winner: 'red'
				}
			: null
	};
}

function twoDayBundle(): EventBundle {
	return {
		event: {
			code: 'USCAXXQ',
			name: 'California Test Qualifier',
			type: 'Qualifier',
			typeName: 'Qualifier',
			region: 'USCALS',
			league: null,
			division: null,
			venue: 'Hall, A',
			address: null,
			city: 'Los Angeles',
			state: 'CA',
			country: 'USA',
			timezone: 'America/Los_Angeles',
			start: '2026-11-21',
			end: '2026-11-22',
			liveStreamUrl: null,
			webcasts: [],
			website: null,
			fieldCount: 1,
			published: true,
			remote: false,
			hybrid: false
		},
		teams: [
			{ number: 3747, name: 'The Hive' },
			{ number: 5678, name: 'Partner; Co' },
			{ number: 1111, name: 'One' },
			{ number: 2222, name: 'Two' }
		].map((team) => ({
			...team,
			fullName: null,
			school: null,
			city: null,
			state: null,
			country: null,
			rookieYear: null
		})),
		matches: [
			qual(1, '2026-11-21T16:00:00', [3747, 5678], [1111, 2222], true),
			qual(2, '2026-11-21T16:10:00', [1111, 5678], [3747, 2222], true),
			qual(3, '2026-11-21T16:20:00', [3747, 1111], [5678, 2222]),
			qual(4, '2026-11-21T16:30:00', [5678, 2222], [1111, 3747]),
			qual(5, '2026-11-22T09:00:00', [2222, 3747], [5678, 1111]),
			qual(6, '2026-11-22T09:10:00', [1111, 2222], [3747, 5678])
		],
		rankings: [],
		alliances: [],
		awards: [],
		advancement: null,
		phase: 'quals',
		fetchedAt: Date.parse('2026-11-22T16:00:00Z'),
		stale: false,
		source: 'ftc'
	};
}

function season(bundle: EventBundle): TeamSeason {
	const { event } = bundle;
	return {
		team: bundle.teams[0],
		events: [
			{
				event: { ...event, hasMatches: true },
				stats: null,
				awards: []
			},
			{
				event: {
					...event,
					code: 'USCAYYQ',
					name: 'Later Qualifier',
					start: '2027-01-16',
					end: '2027-01-16',
					hasMatches: false
				},
				stats: null,
				awards: []
			}
		],
		quickStats: null,
		previousQuickStats: null,
		fetchedAt: bundle.fetchedAt,
		stale: false
	};
}

const MORNING_AFTER = Date.parse('2026-11-22T08:00:00-08:00');

describe('match times', () => {
	it('carries unplayed matches over to the next morning', () => {
		const times = matchTimes(twoDayBundle(), MORNING_AFTER);
		expect(times.get('q2')).toMatchObject({ played: true, estimated: false });
		expect(times.get('q3')).toEqual({
			start: Date.parse('2026-11-22T09:00:00-08:00'),
			estimated: true,
			played: false
		});
		expect(times.get('q4')!.start).toBeGreaterThan(times.get('q3')!.start);
		expect(times.get('q5')!.start).toBeGreaterThan(times.get('q4')!.start);
	});

	it('uses the posted schedule outside the event days', () => {
		const before = Date.parse('2026-11-19T12:00:00Z');
		const times = matchTimes(twoDayBundle(), before);
		expect(times.get('q3')).toEqual({
			start: Date.parse('2026-11-21T16:20:00-08:00'),
			estimated: false,
			played: false
		});
	});
});

describe('team calendar', () => {
	const bundle = twoDayBundle();
	const text = renderCalendar(
		teamCalendar(season(bundle), { USCAXXQ: bundle }, ORIGIN, MORNING_AFTER)
	);
	const events = blocks(text);

	it('lists the team events and only its own matches', () => {
		expect(events.map((block) => field(block, 'UID'))).toEqual([
			'UID:2026-USCAXXQ-3747@ftcpitstop.com',
			'UID:2026-USCAXXQ-q1-3747@ftcpitstop.com',
			'UID:2026-USCAXXQ-q2-3747@ftcpitstop.com',
			'UID:2026-USCAXXQ-q3-3747@ftcpitstop.com',
			'UID:2026-USCAXXQ-q4-3747@ftcpitstop.com',
			'UID:2026-USCAXXQ-q5-3747@ftcpitstop.com',
			'UID:2026-USCAXXQ-q6-3747@ftcpitstop.com',
			'UID:2026-USCAYYQ-3747@ftcpitstop.com'
		]);
	});

	it('keeps the same uids when estimates move', () => {
		const later = renderCalendar(
			teamCalendar(season(bundle), { USCAXXQ: bundle }, ORIGIN, MORNING_AFTER + 3_600_000)
		);
		expect(blocks(later).map((block) => field(block, 'UID'))).toEqual(
			events.map((block) => field(block, 'UID'))
		);
	});

	it('writes the carried-over match on the second day in local time', () => {
		const q3 = events[3];
		expect(field(q3, 'DTSTART')).toBe('DTSTART;TZID=America/Los_Angeles:20261122T090000');
		expect(field(q3, 'SUMMARY')).toBe('SUMMARY:3747 Q3 on red with 1111');
		const description = field(q3, 'DESCRIPTION')!;
		expect(description).toContain('Estimated start 9:00 AM\\, scheduled for 4:20 PM.');
		expect(description).toContain('Alliance: red.');
		expect(description).toContain('Partner: 1111 One.');
		expect(description).toContain('Opponents: 5678 Partner\\; Co and 2222 Two.');
		expect(description).toContain(`${ORIGIN}/events/USCAXXQ/matches/q3`);
		expect(field(q3, 'URL')).toBe(`URL:${ORIGIN}/events/USCAXXQ/matches/q3`);
	});

	it('shows results for played matches', () => {
		expect(field(events[1], 'SUMMARY')).toBe('SUMMARY:3747 Q1 won 40–30 with 5678');
		expect(field(events[2], 'SUMMARY')).toBe('SUMMARY:3747 Q2 lost 30–40 with 2222');
		expect(field(events[1], 'DESCRIPTION')).toContain('Played at 4:00 PM.');
	});

	it('makes events all-day and transparent', () => {
		expect(field(events[0], 'DTSTART')).toBe('DTSTART;VALUE=DATE:20261121');
		expect(field(events[0], 'DTEND')).toBe('DTEND;VALUE=DATE:20261123');
		expect(field(events[0], 'TRANSP')).toBe('TRANSP:TRANSPARENT');
		expect(field(events[0], 'LOCATION')).toBe('LOCATION:Hall\\, A\\, Los Angeles\\, California');
		expect(field(events[7], 'DTSTART')).toBe('DTSTART;VALUE=DATE:20270116');
	});

	it('refreshes often while an event is live', () => {
		expect(unfold(text)).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT15M');
		const quiet = renderCalendar(teamCalendar(season(bundle), {}, ORIGIN, MORNING_AFTER));
		expect(unfold(quiet)).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT360M');
	});

	it('only expects a schedule a few days ahead', () => {
		const event = { start: '2026-11-21', timezone: 'America/Los_Angeles' };
		expect(scheduleLikely(event, Date.parse('2026-11-18T12:00:00-08:00'))).toBe(true);
		expect(scheduleLikely(event, Date.parse('2026-11-17T12:00:00-08:00'))).toBe(false);
	});
});

describe('event calendar', () => {
	const bundle = fixtureBundle('USMTBUQ-final');
	const now = Date.parse('2026-11-25T12:00:00Z');
	const events = blocks(renderCalendar(eventCalendar(bundle, ORIGIN, now)));

	it('has the event and every timed match with unique uids', () => {
		const timedMatches = bundle.matches.filter((match) => match.scheduledTime !== null);
		expect(events).toHaveLength(timedMatches.length + 1);
		const uids = events.map((block) => field(block, 'UID'));
		expect(new Set(uids).size).toBe(uids.length);
		expect(uids[0]).toBe('UID:2026-USMTBUQ@ftcpitstop.com');
		expect(uids[1]).toBe('UID:2026-USMTBUQ-q1@ftcpitstop.com');
	});

	it('lists both alliances and the result', () => {
		const q1 = events[1];
		expect(field(q1, 'SUMMARY')).toMatch(
			/^SUMMARY:Q1 red \d+\\, \d+ vs blue \d+\\, \d+ \(\d+–\d+\)$/
		);
		const description = field(q1, 'DESCRIPTION')!;
		expect(description).toMatch(/\\nRed: \d+ .+\\nBlue: \d+ /);
		expect(description).toMatch(/(Red won|Blue won|Tied)\\, red \d+ to blue \d+\./);
		expect(field(q1, 'DTSTART')).toMatch(/^DTSTART;TZID=America\/Denver:20261121T\d{4}00$/);
	});
});
