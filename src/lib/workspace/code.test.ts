import { describe, expect, it } from 'vitest';
import {
	CODE_ALPHABET,
	CODE_LENGTH,
	formatCode,
	generateCode,
	isCode,
	newId,
	normalizeCode,
	parseEventCode,
	parseTeamNumber
} from '#lib/workspace/code.ts';

describe('join codes', () => {
	it('uses an alphabet without look-alike characters', () => {
		expect(CODE_ALPHABET).toHaveLength(31);
		for (const character of 'IL01O') expect(CODE_ALPHABET).not.toContain(character);
		expect(new Set(CODE_ALPHABET).size).toBe(CODE_ALPHABET.length);
	});

	it('generates six character codes from the alphabet', () => {
		for (let i = 0; i < 200; i++) {
			const code = generateCode();
			expect(code).toHaveLength(CODE_LENGTH);
			expect(isCode(code)).toBe(true);
		}
	});

	it('maps random bytes onto the alphabet without bias', () => {
		const bytes = Uint8Array.from([0, 1, 2, 30, 31, 248, 249, 255, 5, 6, 7, 8]);
		expect(generateCode(() => bytes)).toBe('ABC9AF');
	});

	it('asks for more bytes when too many are rejected', () => {
		const calls: number[] = [];
		const code = generateCode((length) => {
			calls.push(length);
			return calls.length === 1 ? new Uint8Array(length).fill(255) : new Uint8Array(length).fill(3);
		});
		expect(calls.length).toBe(2);
		expect(code).toBe('DDDDDD');
	});

	it('normalizes what people type', () => {
		expect(normalizeCode('abc-d3f')).toBe('ABCD3F');
		expect(normalizeCode(' abc d3f ')).toBe('ABCD3F');
		expect(normalizeCode('ABCD3')).toBeNull();
		expect(normalizeCode('ABCD3FG')).toBeNull();
		expect(normalizeCode('ABCD0F')).toBeNull();
		expect(normalizeCode('ABCDIF')).toBeNull();
		expect(normalizeCode('')).toBeNull();
	});

	it('formats a code in two groups', () => {
		expect(formatCode('ABCD3F')).toBe('ABC-D3F');
	});
});

describe('team numbers and event codes', () => {
	it('accepts one to six digits', () => {
		expect(parseTeamNumber('14624')).toBe(14624);
		expect(parseTeamNumber(' 7 ')).toBe(7);
		expect(parseTeamNumber(999999)).toBe(999999);
		expect(parseTeamNumber('0')).toBeNull();
		expect(parseTeamNumber('1000000')).toBeNull();
		expect(parseTeamNumber('12a')).toBeNull();
		expect(parseTeamNumber('')).toBeNull();
		expect(parseTeamNumber('-5')).toBeNull();
	});

	it('uppercases event codes and rejects other characters', () => {
		expect(parseEventCode(' usazgiq ')).toBe('USAZGIQ');
		expect(parseEventCode('a')).toBeNull();
		expect(parseEventCode('US AZ')).toBeNull();
		expect(parseEventCode('US/AZ')).toBeNull();
	});

	it('makes short unique ids', () => {
		const ids = new Set(Array.from({ length: 500 }, () => newId()));
		expect(ids.size).toBe(500);
		for (const id of ids) expect(id).toMatch(/^[0-9a-z]{8}$/);
	});
});
