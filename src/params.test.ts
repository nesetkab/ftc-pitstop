import { describe, expect, it } from 'vitest';
import { params } from './params.ts';

function team(value: string): number | null {
	const result = params.team['~standard'].validate(value) as { value?: number; issues?: unknown[] };
	return result.issues ? null : (result.value ?? null);
}

describe('team param', () => {
	it('accepts team numbers the FTC API can know', () => {
		expect(team('1')).toBe(1);
		expect(team('26670')).toBe(26670);
		expect(team('99999')).toBe(99999);
	});

	it.each(['0', '01', '100000', '999999', '-1', '1e3', '1.5', '0x1f', ' 12', '12 ', 'abc', ''])(
		'refuses %j',
		(value) => {
			expect(team(value)).toBeNull();
		}
	);
});
