import { describe, expect, it } from 'vitest';
import { NAV_LINKS, navCurrent } from './nav.ts';

function active(path: string) {
	return NAV_LINKS.filter((link) => navCurrent(path, link)).map((link) => link.label);
}

describe('navCurrent', () => {
	it('marks the exact page', () => {
		const compare = NAV_LINKS.find((link) => link.href === '/compare')!;
		expect(navCurrent('/compare', compare)).toBe('page');
	});

	it.each([
		['/events', 'Events'],
		['/events/USMTBUQ', 'Events'],
		['/events/strength', 'Events'],
		['/advancement', 'Events'],
		['/advancement/USMT', 'Events'],
		['/regions', 'Events'],
		['/regions/USMT', 'Events'],
		['/leaderboards', 'Leaderboards'],
		['/records', 'Records'],
		['/compare', 'Compare'],
		['/simulate', 'Compare']
	])('highlights one item on %s', (path, label) => {
		expect(active(path)).toEqual([label]);
	});

	it.each(['/', '/teams/724', '/about', '/w', '/eventsx', '/simulated'])(
		'highlights nothing on %s',
		(path) => {
			expect(active(path)).toEqual([]);
		}
	);
});
