import { describe, expect, it } from 'vitest';
import { eventLede } from './lede.ts';
import { fixtureBundle, unplay } from './test-fixtures.ts';

describe('event lede', () => {
	it('names the winning alliance once the event is decided', () => {
		const bundle = fixtureBundle('USAZGIQ');
		const alliance = bundle.alliances.find((entry) => entry.seed === 2);
		const lede = eventLede(bundle);
		expect(lede?.lead).toContain(String(alliance?.captain));
		expect(lede?.lead).toMatch(/ won the event$/);
		expect(lede?.rest).toBe('as alliance 2.');
	});

	it('says nothing before the event is decided, since the rankings show the leader', () => {
		const bundle = unplay(fixtureBundle('USAZGIQ'), (match) => match.level === 'playoff');
		expect(eventLede(bundle)).toBeNull();
	});

	it('says nothing before a match is played', () => {
		const bundle = fixtureBundle('USAZGIQ');
		expect(eventLede({ ...bundle, alliances: [] })).toBeNull();
	});
});
