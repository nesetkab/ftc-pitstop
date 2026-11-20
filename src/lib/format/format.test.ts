import { describe, expect, it } from 'vitest';
import {
	dateRange,
	fixed,
	httpUrl,
	integer,
	longDate,
	matchKey,
	matchLabel,
	matchTitle,
	ordinal,
	parseMatchDescription,
	parseMatchKey,
	pct,
	record,
	relative,
	relativeDay,
	shortDate,
	shortMatchLabel,
	signed,
	time,
	timeWithSeconds
} from './index.ts';

const PHOENIX = 'America/Phoenix';
const NBSP = ' ';

describe('pct', () => {
	it('rounds to whole percents', () => {
		expect(pct(0.51)).toBe('51%');
		expect(pct(0.586)).toBe('59%');
		expect(pct(0.005)).toBe('1%');
		expect(pct(0.994)).toBe('99%');
	});

	it('clamps the tails', () => {
		expect(pct(0.004)).toBe('<1%');
		expect(pct(0.995)).toBe('>99%');
		expect(pct(0)).toBe('<1%');
		expect(pct(1)).toBe('>99%');
	});

	it('shows a dash when there is no value', () => {
		expect(pct(null)).toBe('—');
		expect(pct(undefined)).toBe('—');
		expect(pct(Number.NaN)).toBe('—');
	});
});

describe('numbers', () => {
	it('uses fixed decimals', () => {
		expect(fixed(25.1)).toBe('25.1');
		expect(fixed(3.333, 2)).toBe('3.33');
		expect(fixed(58, 1)).toBe('58.0');
		expect(fixed(57.6, 0)).toBe('58');
	});

	it('uses a real minus sign and never shows negative zero', () => {
		expect(fixed(-1.3)).toBe('−1.3');
		expect(fixed(-0.04)).toBe('0.0');
	});

	it('signs differences', () => {
		expect(signed(15.2)).toBe('+15.2');
		expect(signed(-11.2)).toBe('−11.2');
		expect(signed(0.04)).toBe('0.0');
	});

	it('groups thousands', () => {
		expect(integer(3272)).toBe('3,272');
	});

	it('shows a dash when there is no value', () => {
		expect(fixed(null)).toBe('—');
		expect(signed(undefined)).toBe('—');
		expect(integer(Number.POSITIVE_INFINITY)).toBe('—');
	});
});

describe('record', () => {
	it('joins wins, losses and ties', () => {
		expect(record(3, 0, 0)).toBe('3-0-0');
		expect(record(7, 2)).toBe('7-2-0');
	});
});

describe('ordinal', () => {
	it('handles the teens and the usual endings', () => {
		expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 93, 111, 112].map(ordinal)).toEqual([
			'1st',
			'2nd',
			'3rd',
			'4th',
			'11th',
			'12th',
			'13th',
			'21st',
			'22nd',
			'23rd',
			'93rd',
			'111th',
			'112th'
		]);
	});
});

describe('time', () => {
	const queue = new Date('2026-11-14T20:46:00Z');

	it('formats a time in the event time zone', () => {
		expect(time(queue, PHOENIX)).toBe(`1:46${NBSP}PM`);
		expect(time(queue, 'America/New_York')).toBe(`3:46${NBSP}PM`);
		expect(timeWithSeconds('2026-11-14T20:41:02Z', PHOENIX)).toBe(`1:41:02${NBSP}PM`);
	});

	it('formats long and short dates', () => {
		expect(longDate(queue, PHOENIX)).toBe('Saturday, November 14, 2026');
		expect(shortDate(queue, PHOENIX)).toBe('Nov 14');
	});

	it('treats date-only strings as calendar days', () => {
		expect(longDate('2026-11-14', PHOENIX)).toBe('Saturday, November 14, 2026');
		expect(shortDate('2026-11-14', 'Pacific/Honolulu')).toBe('Nov 14');
	});

	it('formats event date ranges', () => {
		expect(dateRange('2026-11-14', '2026-11-14')).toBe('Saturday, November 14, 2026');
		expect(dateRange('2026-11-20', '2026-11-21')).toBe('November 20 and 21, 2026');
		expect(dateRange('2026-11-20', '2026-11-22')).toBe('November 20 to 22, 2026');
		expect(dateRange('2026-10-31', '2026-11-01')).toBe('October 31 and November 1, 2026');
		expect(dateRange('2026-12-31', '2027-01-02')).toBe('December 31, 2026 to January 2, 2027');
	});
});

describe('relativeDay', () => {
	const now = Date.parse('2026-11-20T22:00:00Z');
	const DENVER = 'America/Denver';

	it('says nothing for later today', () => {
		expect(relativeDay(Date.parse('2026-11-21T05:30:00Z'), now, DENVER)).toBeNull();
	});

	it('names tomorrow, the rest of the week and later dates', () => {
		expect(relativeDay(Date.parse('2026-11-21T16:00:00Z'), now, DENVER)).toBe('tomorrow');
		expect(relativeDay(Date.parse('2026-11-23T16:00:00Z'), now, DENVER)).toBe('on Monday');
		expect(relativeDay(Date.parse('2026-12-05T16:00:00Z'), now, DENVER)).toBe('on Dec 5');
		expect(relativeDay(Date.parse('2026-11-19T16:00:00Z'), now, DENVER)).toBe('on Nov 19');
	});
});

describe('relative', () => {
	const now = new Date('2026-11-14T20:41:14Z');
	const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

	it('describes past times', () => {
		expect(relative(ago(2), now)).toBe('just now');
		expect(relative(ago(12), now)).toBe('12 seconds ago');
		expect(relative(ago(60), now)).toBe('1 minute ago');
		expect(relative(ago(14 * 60), now)).toBe('14 minutes ago');
		expect(relative(ago(3599), now)).toBe('1 hour ago');
		expect(relative(ago(3 * 3600), now)).toBe('3 hours ago');
		expect(relative(ago(2 * 86400), now)).toBe('2 days ago');
	});

	it('describes future times', () => {
		expect(relative(ago(-5 * 60), now)).toBe('in 5 minutes');
	});
});

describe('match labels', () => {
	it('labels qualification and playoff matches', () => {
		expect(matchLabel({ level: 'qual', number: 26 })).toBe('Q26');
		expect(matchLabel({ level: 'playoff', series: 3 })).toBe('M3');
		expect(matchLabel({ level: 'playoff', series: 10, game: 2 })).toBe('M10-2');
		expect(matchLabel({ level: 'playoff', series: 10, game: 1 })).toBe('M10');
	});

	it('builds and reads url keys', () => {
		expect(matchKey({ level: 'qual', number: 26 })).toBe('q26');
		expect(matchKey({ level: 'playoff', series: 3 })).toBe('p3');
		expect(parseMatchKey('q26')).toEqual({ level: 'qual', number: 26 });
		expect(parseMatchKey('P3')).toEqual({ level: 'playoff', series: 3 });
		expect(parseMatchKey('p10-2')).toEqual({ level: 'playoff', series: 10, game: 2 });
		expect(parseMatchKey('q26-2')).toBeNull();
		expect(parseMatchKey('x1')).toBeNull();
	});

	it('reads FTC Events and FTCScout descriptions', () => {
		expect(parseMatchDescription('Qualification 26')).toEqual({ level: 'qual', number: 26 });
		expect(parseMatchDescription('Q-1')).toEqual({ level: 'qual', number: 1 });
		expect(parseMatchDescription('Upper Bracket  Round 1 Match 1')).toEqual({
			level: 'playoff',
			series: 1,
			bracket: 'upper',
			round: 1
		});
		expect(parseMatchDescription('Final Bracket  Round 6 Match 10')).toEqual({
			level: 'playoff',
			series: 10,
			bracket: 'final',
			round: 6
		});
		expect(parseMatchDescription('M-10')).toEqual({ level: 'playoff', series: 10 });
		expect(parseMatchDescription('Practice 1')).toBeNull();
	});

	it('shortens descriptions and leaves unknown ones alone', () => {
		expect(shortMatchLabel('Qualification 26')).toBe('Q26');
		expect(shortMatchLabel('Upper Bracket  Round 1 Match 1')).toBe('M1');
		expect(shortMatchLabel('Lower Bracket  Round 2 Match 5')).toBe('M5');
		expect(shortMatchLabel('Practice 1')).toBe('Practice 1');
	});

	it('writes titles in sentence case', () => {
		expect(matchTitle({ level: 'qual', number: 26 })).toBe('Qualification 26');
		expect(matchTitle(parseMatchDescription('Upper Bracket  Round 1 Match 1')!)).toBe(
			'Upper bracket round 1 match 1'
		);
		expect(matchTitle(parseMatchDescription('Final Bracket  Round 6 Match 10')!)).toBe(
			'Finals match 10'
		);
		expect(matchTitle({ level: 'playoff', series: 3, game: 2 })).toBe('Playoff match 3, game 2');
	});
});

describe('httpUrl', () => {
	it('keeps web addresses and normalizes them', () => {
		expect(httpUrl('https://www.youtube.com/live/abc')).toBe('https://www.youtube.com/live/abc');
		expect(httpUrl('  HTTP://Twitch.tv/pitstop  ')).toBe('http://twitch.tv/pitstop');
		expect(httpUrl('https://example.com/a b')).toBe('https://example.com/a%20b');
	});

	it.each([
		'javascript:alert(1)',
		'JaVaScRiPt:alert(1)',
		' javascript:alert(1)',
		'java\tscript:alert(1)',
		'data:text/html,<script>alert(1)</script>',
		'vbscript:msgbox(1)',
		'file:///etc/passwd',
		'blob:https://example.com/x',
		'//evil.example/x',
		'/relative/path',
		'www.twitch.tv/no-scheme',
		'https://user:pass@example.com/',
		'https://twitch.tv@evil.example/',
		'https://',
		'',
		'   '
	])('refuses %j', (value) => {
		expect(httpUrl(value)).toBeNull();
	});

	it('refuses missing values and absurd lengths', () => {
		expect(httpUrl(null)).toBeNull();
		expect(httpUrl(undefined)).toBeNull();
		expect(httpUrl(`https://example.com/${'a'.repeat(2100)}`)).toBeNull();
	});
});
