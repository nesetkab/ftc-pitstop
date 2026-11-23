import { describe, expect, it } from 'vitest';
import { MAX_HITS, teamHits } from './finder.ts';

describe('teamHits', () => {
	it('keeps team results with their number, name and place', () => {
		expect(
			teamHits([
				{ type: 'event', label: 'Gilbert Qualifier', href: '/events/USAZGIQ' },
				{
					type: 'team',
					label: '26670 SCA Iron Eagles',
					sublabel: 'Gilbert, AZ',
					href: '/teams/26670'
				},
				{ type: 'team', label: '3747 The Hive', href: '/teams/3747' }
			])
		).toEqual([
			{ number: 26670, name: 'SCA Iron Eagles', place: 'Gilbert, AZ' },
			{ number: 3747, name: 'The Hive', place: null }
		]);
	});

	it('shows only the first few teams', () => {
		const many = Array.from({ length: 9 }, (_, index) => ({
			type: 'team' as const,
			label: `${index + 1} Team`,
			href: `/teams/${index + 1}`
		}));
		expect(teamHits(many)).toHaveLength(MAX_HITS);
	});
});
