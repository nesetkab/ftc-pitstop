import { describe, expect, it } from 'vitest';
import { placeName } from './places.ts';

describe('placeName', () => {
	it('joins the city and the full state name', () => {
		expect(placeName('Plano', 'TX', 'USA')).toBe('Plano, Texas');
	});

	it('does not repeat a state or country the city already names', () => {
		expect(placeName('Plano, Texas', 'TX', 'USA')).toBe('Plano, Texas');
		expect(placeName('Lima, Peru', null, 'Peru')).toBe('Lima, Peru');
		expect(placeName('Washington', 'WA', 'USA')).toBe('Washington');
	});

	it('copes with missing parts', () => {
		expect(placeName(null, 'TX', 'USA')).toBe('Texas');
		expect(placeName(null, null, null)).toBeNull();
	});
});
