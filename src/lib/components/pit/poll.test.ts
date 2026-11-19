import { describe, expect, it } from 'vitest';
import { connection, isStale, MAX_BACKOFF, retryDelay, STALE_AFTER } from './poll.ts';
import { encodeQr } from './qr.ts';

describe('polling', () => {
	it('backs off after errors and caps the wait', () => {
		expect(retryDelay(15_000, 0)).toBe(15_000);
		expect(retryDelay(15_000, 1)).toBe(30_000);
		expect(retryDelay(15_000, 2)).toBe(60_000);
		expect(retryDelay(15_000, 5)).toBe(MAX_BACKOFF);
		expect(retryDelay(10_000, 8, 300_000)).toBe(300_000);
	});

	it('marks data stale after three minutes', () => {
		expect(isStale(null, 1_000_000)).toBe(false);
		expect(isStale(0, STALE_AFTER)).toBe(false);
		expect(isStale(0, STALE_AFTER + 1)).toBe(true);
	});

	it('reports the connection state', () => {
		expect(connection(0, true)).toBe('connected');
		expect(connection(2, true)).toBe('retrying');
		expect(connection(0, false)).toBe('offline');
	});
});

describe('encodeQr', () => {
	it('encodes the phone link', () => {
		const code = encodeQr('https://ftcpitstop.com/14624');
		const rows = code.modules.map((row) => row.map((dark) => (dark ? '#' : '.')).join(''));
		expect(code.size).toBe(29);
		expect(rows).toEqual([
			'#######...##.###.###..#######',
			'#.....#....#######..#.#.....#',
			'#.###.#.#.#..#.#....#.#.###.#',
			'#.###.#.##....##.###..#.###.#',
			'#.###.#.#..##..##..##.#.###.#',
			'#.....#.##..#.....#.#.#.....#',
			'#######.#.#.#.#.#.#.#.#######',
			'........#.##..#.#..##........',
			'#.#####....#....####..#####..',
			'..#.........####...######...#',
			'.#....##.....####...###.#....',
			'.#..##.###...#.#..##....##.#.',
			'.#.#.##.#...#.##.##....#.##..',
			'##...#...####..##..##.###...#',
			'...#.##...###....#.....#.##..',
			'.#...#.#.###..#.#.####..#..#.',
			'##.#..##.###....####.....##..',
			'####...####.####...#..###.#.#',
			'#.###.#.###..######..#..#.#..',
			'#.####...##.##.#..#...###..#.',
			'#...#.####....##.##.#####.###',
			'........#.#....##..##...#####',
			'#######..####......##.#.###..',
			'#.....#.#..##.#.#.###...#..#.',
			'#.###.#.####....#.#.#####.#.#',
			'#.###.#.########.####..#.##..',
			'#.###.#.#..#..####.##.######.',
			'#.....#...#.##.#.##.#....#.#.',
			'#######.#..##.##...#.#.##.#..'
		]);
	});

	it('picks bigger versions for longer text', () => {
		expect(encodeQr('HELLO').size).toBe(21);
		expect(encodeQr('x'.repeat(150), 'L').size).toBe(45);
		expect(() => encodeQr('x'.repeat(3000), 'H')).toThrow(RangeError);
	});
});
