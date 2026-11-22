import { describe, expect, it } from 'vitest';
import {
	areaName,
	isUnitedStates,
	knownRegion,
	placeName,
	regionName,
	stateName
} from './places.ts';

describe('regionName', () => {
	it('names single-state US regions and Canadian provinces', () => {
		expect(regionName('USMI')).toBe('Michigan');
		expect(regionName('USMT')).toBe('Montana');
		expect(regionName('CAAB')).toBe('Alberta');
		expect(regionName('CAON')).toBe('Ontario');
	});

	it('names split and special regions', () => {
		expect(regionName('USCANO')).toBe('California NorCal');
		expect(regionName('USTXHO')).toBe('Texas Houston');
		expect(regionName('USNYLI')).toBe('New York Long Island');
		expect(regionName('USCHS')).toBe('Chesapeake');
		expect(regionName('ONADOD')).toBe('Military and Diplomatic');
	});

	it('names country regions', () => {
		expect(regionName('KZ')).toBe('Kazakhstan');
		expect(regionName('IN')).toBe('India');
		expect(regionName('MA')).toBe('Morocco');
		expect(regionName('TR')).toBe('Türkiye');
		expect(regionName('NL')).toBe('Benelux');
	});

	it('ignores case and surrounding space', () => {
		expect(regionName(' usmi ')).toBe('Michigan');
	});

	it('falls back to the raw code when the code is unknown', () => {
		expect(regionName('USZZ')).toBe('USZZ');
		expect(regionName('CAZZ')).toBe('CAZZ');
		expect(regionName('XQZ9')).toBe('XQZ9');
		expect(regionName('ZZ')).toBe('ZZ');
		expect(regionName('QX')).toBe('QX');
		expect(knownRegion('USZZ')).toBeNull();
		expect(knownRegion('ZZ')).toBeNull();
	});

	it('returns null for a missing code', () => {
		expect(regionName(null)).toBeNull();
		expect(regionName('')).toBeNull();
		expect(knownRegion(undefined)).toBeNull();
	});
});

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
