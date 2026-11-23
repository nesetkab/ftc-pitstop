import { describe, expect, it } from 'vitest';
import { round, toCsv } from './csv.ts';

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

describe('round', () => {
	it('rounds to the given digits and drops missing values', () => {
		expect(round(1.23456)).toBe(1.23);
		expect(round(51.26, 1)).toBe(51.3);
		expect(round(null)).toBeNull();
		expect(round(Number.POSITIVE_INFINITY)).toBeNull();
	});
});
