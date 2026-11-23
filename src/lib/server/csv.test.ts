import { describe, expect, it } from 'vitest';
import { csvResponse } from './csv.ts';

describe('csvResponse', () => {
	it('sends a CSV attachment with the given cache header', async () => {
		const response = csvResponse('A\r\n', 'x.csv', 'public, s-maxage=60');
		expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
		expect(response.headers.get('content-disposition')).toBe('attachment; filename="x.csv"');
		expect(response.headers.get('cache-control')).toBe('public, s-maxage=60');
		expect(await response.text()).toBe('A\r\n');
	});
});
