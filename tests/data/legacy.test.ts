import { describe, expect, it } from 'vitest';
import { legacyRedirect } from '#lib/server/legacy.ts';

describe('legacy redirects', () => {
	it('sends old event pages to the matching event tab', () => {
		expect(legacyRedirect('/event/usmtbuq')).toBe('/events/USMTBUQ');
		expect(legacyRedirect('/bracket/USAZGIQ')).toBe('/events/USAZGIQ/playoffs');
		expect(legacyRedirect('/comparison/USAZGIQ')).toBe('/events/USAZGIQ/teams');
		expect(legacyRedirect('/predictions/USAZGIQ/')).toBe('/events/USAZGIQ/schedule');
	});

	it('sends the old team dashboard to the phone view for that event', () => {
		expect(legacyRedirect('/dashboard/usmtbuq/3747')).toBe('/3747?event=USMTBUQ');
		expect(legacyRedirect('/dashboard')).toBe('/');
	});

	it('sends old scouting pages to the team workspace', () => {
		expect(legacyRedirect('/scout')).toBe('/w');
		expect(legacyRedirect('/scout/session-12')).toBe('/w');
	});

	it('leaves current and malformed paths alone', () => {
		for (const path of [
			'/',
			'/events/USMTBUQ',
			'/3747/tv',
			'/dashboard/USMTBUQ',
			'/dashboard/USMTBUQ/0',
			'/dashboard/USMTBUQ/123456',
			'/dashboard/US-MT/3747',
			'/event/USMTBUQ/extra',
			'/event/X',
			'/constructor/USMTBUQ',
			'/scouting'
		]) {
			expect(legacyRedirect(path)).toBeNull();
		}
	});
});
