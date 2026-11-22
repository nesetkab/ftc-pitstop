import { describe, expect, it } from 'vitest';
import { csvResponse, round, toCsv } from './csv.ts';

describe('toCsv', () => {
	it('quotes commas, quotes and line breaks and leaves empty cells blank', () => {
		expect(
			toCsv(
				['A', 'B'],
				[
					['x, y', 'say "hi"'],
					[null, 3],
					['line\nbreak', Number.NaN]
				]
			)
		).toBe('A,B\r\n"x, y","say ""hi"""\r\n,3\r\n"line\nbreak",\r\n');
	});

	it('defuses text that a spreadsheet would run as a formula', () => {
		expect(toCsv(['Name'], [['=HYPERLINK("x")'], ['-1+2'], ['@cmd']])).toBe(
			'Name\r\n"\'=HYPERLINK(""x"")"\r\n\'-1+2\r\n\'@cmd\r\n'
		);
	});
});

describe('csvResponse', () => {
	it('sends a CSV attachment with the given cache header', async () => {
		const response = csvResponse('A\r\n', 'x.csv', 'public, s-maxage=60');
		expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
		expect(response.headers.get('content-disposition')).toBe('attachment; filename="x.csv"');
		expect(response.headers.get('cache-control')).toBe('public, s-maxage=60');
		expect(await response.text()).toBe('A\r\n');
	});
});

describe('round', () => {
	it('rounds to the given digits and drops missing values', () => {
		expect(round(1.23456)).toBe(1.23);
		expect(round(51.26, 1)).toBe(51.3);
		expect(round(null)).toBeNull();
		expect(round(Number.POSITIVE_INFINITY)).toBeNull();
	});
});
