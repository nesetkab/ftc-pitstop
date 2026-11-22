import { describe, expect, it } from 'vitest';
import { areaName, isUnitedStates, placeName, stateName } from './places.ts';

describe('placeName', () => {
	it('writes US places with the full state name', () => {
		expect(placeName({ city: 'Phoenix', state: 'AZ', country: 'USA' })).toBe('Phoenix, Arizona');
	});

	it('keeps the abbreviation in the short style', () => {
		expect(placeName({ city: 'Phoenix', state: 'AZ', country: 'USA' }, 'short')).toBe(
			'Phoenix, AZ'
		);
	});

	it('writes Canadian provinces in full and leaves the country out', () => {
		expect(placeName({ city: 'Toronto', state: 'ON', country: 'Canada' })).toBe('Toronto, Ontario');
	});

	it('uses the country for other places and skips arbitrary state codes', () => {
		expect(placeName({ city: 'Shanghai', state: 'SH', country: 'China' })).toBe('Shanghai, China');
		expect(placeName({ city: 'Shanghai', state: 'SH', country: 'China' }, 'short')).toBe(
			'Shanghai, China'
		);
	});

	it('does not repeat the city as a state and copes with missing parts', () => {
		expect(placeName({ city: 'Washington', state: 'Washington', country: 'USA' })).toBe(
			'Washington'
		);
		expect(placeName({ city: 'Washington', state: 'WA', country: 'USA' })).toBe('Washington');
		expect(placeName({ city: null, state: null, country: 'Chile' })).toBe('Chile');
		expect(placeName({ city: null, state: 'TX', country: 'USA' })).toBe('Texas');
		expect(placeName({ city: null, state: null, country: null })).toBe('');
	});
});

describe('placeName with a city that already names its region', () => {
	it('does not repeat the state or country', () => {
		expect(placeName({ city: 'Plano, Texas', state: 'TX', country: 'USA' })).toBe('Plano, Texas');
		expect(placeName({ city: 'Plano, TX', state: 'TX', country: 'USA' }, 'short')).toBe(
			'Plano, TX'
		);
		expect(placeName({ city: 'Lima, Peru', state: null, country: 'Peru' })).toBe('Lima, Peru');
	});
});

describe('stateName', () => {
	it('maps known abbreviations and passes unknown ones through', () => {
		expect(stateName('az', 'USA')).toBe('Arizona');
		expect(stateName('GU', 'United States')).toBe('Guam');
		expect(stateName('XX', 'Canada')).toBe('XX');
		expect(stateName('SH', 'China')).toBeNull();
		expect(stateName(null, 'USA')).toBeNull();
	});
});

describe('areaName', () => {
	it('uses the state in the US and Canada and the country elsewhere', () => {
		expect(areaName('TX', 'US')).toBe('Texas');
		expect(areaName(null, 'USA')).toBeNull();
		expect(areaName('SH', 'China')).toBe('China');
		expect(isUnitedStates('United States of America')).toBe(true);
		expect(isUnitedStates(null)).toBe(false);
	});
});
