import { describe, expect, it } from 'vitest';
import { bannerLabel, isBanner, seasonYears } from './banners.ts';

describe('isBanner', () => {
	it('counts the winning alliance and inspire at championships and premier events', () => {
		expect(isBanner({ id: 13, placement: 1 }, 'Championship')).toBe(true);
		expect(isBanner({ id: 13, placement: 1 }, 'FIRSTChampionship')).toBe(true);
		expect(isBanner({ id: 11, placement: 1 }, 'Championship')).toBe(true);
		expect(isBanner({ id: 13, placement: 1 }, 'Premier')).toBe(true);
	});

	it('skips other awards, places and events', () => {
		expect(isBanner({ id: 11, placement: 2 }, 'Championship')).toBe(false);
		expect(isBanner({ id: 12, placement: 1 }, 'Championship')).toBe(false);
		expect(isBanner({ id: 4, placement: 1 }, 'FIRSTChampionship')).toBe(false);
		expect(isBanner({ id: 13, placement: 1 }, 'Qualifier')).toBe(false);
		expect(isBanner({ id: 11, placement: 1 }, 'SuperQualifier')).toBe(false);
		expect(isBanner({ id: 13, placement: 1 }, 'LeagueTournament')).toBe(false);
	});
});

describe('bannerLabel', () => {
	it('names the banner', () => {
		expect(bannerLabel({ id: 13 })).toBe('Winner');
		expect(bannerLabel({ id: 11 })).toBe('Inspire Award');
	});
});

describe('seasonYears', () => {
	it('writes the season as two years', () => {
		expect(seasonYears(2025)).toBe('2025-26');
		expect(seasonYears(2099)).toBe('2099-00');
	});
});
