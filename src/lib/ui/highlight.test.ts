import { describe, expect, it } from 'vitest';
import { highlight } from './highlight.ts';

describe('highlight', () => {
	it('marks the first match ignoring case', () => {
		expect(highlight('3747 The Hive', 'hive')).toEqual([
			{ text: '3747 The ', hit: false },
			{ text: 'Hive', hit: true }
		]);
	});

	it('leaves text alone when nothing matches', () => {
		expect(highlight('Utah Championship', 'zz')).toEqual([
			{ text: 'Utah Championship', hit: false }
		]);
		expect(highlight('Utah Championship', '  ')).toEqual([
			{ text: 'Utah Championship', hit: false }
		]);
	});
});
