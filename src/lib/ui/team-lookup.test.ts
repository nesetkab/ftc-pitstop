import { describe, expect, it, vi } from 'vitest';
import { isNumberEntry, MAX_HITS, needsLookup, teamHits, teamLookup } from './team-lookup.ts';

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

describe('team entry', () => {
	it('treats digits, spaces and commas as numbers', () => {
		expect(isNumberEntry('3747')).toBe(true);
		expect(isNumberEntry('19666 7759, 724')).toBe(true);
		expect(isNumberEntry('the hive')).toBe(false);
		expect(isNumberEntry('25a620')).toBe(false);
	});

	it('looks up names and single numbers but not lists of numbers', () => {
		expect(needsLookup('hive')).toBe(true);
		expect(needsLookup(' 3747 ')).toBe(true);
		expect(needsLookup('19666 7759')).toBe(false);
		expect(needsLookup('   ')).toBe(false);
	});
});

describe('teamLookup', () => {
	const signal = new AbortController().signal;
	const hive = { type: 'team' as const, label: '3747 The Hive', href: '/teams/3747' };

	it('asks search once for the same name typed again in any field', async () => {
		const search = vi.fn(async () => [hive]);
		const lookup = teamLookup(search);
		expect(await lookup('The Hive', signal)).toEqual([
			{ number: 3747, name: 'The Hive', place: null }
		]);
		expect(await lookup('  the   hive ', signal)).toHaveLength(1);
		expect(teamLookup(search)).toBe(lookup);
		expect(search).toHaveBeenCalledOnce();
		expect(search).toHaveBeenCalledWith('The Hive', signal);
	});

	it('asks again after a search that found nothing', async () => {
		const search = vi.fn(async () => []);
		const lookup = teamLookup(search);
		await lookup('hive', signal);
		await lookup('hive', signal);
		expect(search).toHaveBeenCalledTimes(2);
	});

	it('passes search failures on', async () => {
		const lookup = teamLookup(async () => {
			throw new Error('offline');
		});
		await expect(lookup('hive', signal)).rejects.toThrow('offline');
	});
});
