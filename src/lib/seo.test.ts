import { describe, expect, it } from 'vitest';
import { fixtureBundle } from '#lib/components/event/test-fixtures.ts';
import {
	articleJsonLd,
	breadcrumbs,
	eventDescription,
	eventJsonLd,
	jsonLdScript,
	matchDescription,
	teamDescription,
	teamTitle
} from './seo.ts';

const ORIGIN = 'https://www.ftcpitstop.com';

describe('structured data', () => {
	it('keeps JSON-LD from closing its script tag early', () => {
		const html = jsonLdScript({ name: '</script><script>alert(1)</script> & co' });
		expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
		expect(html.match(/<\/script>/g)).toHaveLength(1);
		const body = html.slice(html.indexOf('>') + 1, html.lastIndexOf('<'));
		expect(JSON.parse(body).name).toBe('</script><script>alert(1)</script> & co');
	});

	it('describes an explainer page as an article on the site', () => {
		const data = articleJsonLd(ORIGIN, {
			path: '/about',
			headline: 'About the numbers',
			description: 'How it works.',
			sections: ['OPR', 'Glossary']
		});
		expect(data).toMatchObject({
			'@type': 'TechArticle',
			headline: 'About the numbers',
			url: `${ORIGIN}/about`,
			articleSection: ['OPR', 'Glossary'],
			isPartOf: { '@type': 'WebSite', url: `${ORIGIN}/` }
		});
	});

	it('describes an event as a SportsEvent with its place and dates', () => {
		const { event } = fixtureBundle('USAZGIQ');
		const data = eventJsonLd(ORIGIN, event);
		expect(data).toMatchObject({
			'@type': 'SportsEvent',
			name: event.name,
			startDate: event.start,
			endDate: event.end,
			url: `${ORIGIN}/events/USAZGIQ`,
			location: { '@type': 'Place', address: { '@type': 'PostalAddress' } }
		});
	});

	it('numbers breadcrumbs from the home page', () => {
		const data = breadcrumbs(ORIGIN, [
			{ name: 'PitStop', path: '/' },
			{ name: 'Events', path: '/events' }
		]);
		expect(data.itemListElement).toEqual([
			{ '@type': 'ListItem', position: 1, name: 'PitStop', item: `${ORIGIN}/` },
			{ '@type': 'ListItem', position: 2, name: 'Events', item: `${ORIGIN}/events` }
		]);
	});
});

describe('search text', () => {
	const team = {
		number: 724,
		name: 'RedNek Robotics Wun',
		place: 'Sun River, Montana',
		rookieYear: 2007
	};

	it('names a team with its place, season OPR and world rank', () => {
		expect(teamTitle(team)).toBe('FTC 724 RedNek Robotics Wun (Sun River, Montana) - PitStop');
		expect(
			teamDescription(team, {
				opr: 57.24,
				rank: 201,
				of: 3871,
				record: { wins: 4, losses: 1, ties: 0 },
				events: 1
			})
		).toBe(
			'FTC team 724 RedNek Robotics Wun from Sun River, Montana. 2026-27 BIOBUZZ OPR 57.2, 201st of 3,871 teams worldwide. Qualification record 4-1-0 across 1 event. Match history, OPR by part and awards.'
		);
	});

	it('leaves out stats a team does not have yet', () => {
		expect(
			teamDescription(
				{ ...team, place: '' },
				{ opr: null, rank: null, of: null, record: null, events: 0 }
			)
		).toBe('FTC team 724 RedNek Robotics Wun. Match history, OPR by part and awards.');
	});

	it('says where and when an event is and whether it is over', () => {
		const { event } = fixtureBundle('USAZGIQ');
		const text = eventDescription(event, 'done', 'Award winners.');
		expect(text.startsWith(`${event.name}: `)).toBe(true);
		expect(text).toContain('Final results. Award winners.');
		expect(eventDescription(event, 'live', 'Award winners.')).toContain('Happening now');
	});

	it('sums up a played match with the winner first', () => {
		const bundle = fixtureBundle('USAZGIQ');
		const match = bundle.matches.find((entry) => entry.result?.winner === 'blue')!;
		const text = matchDescription(match, 'Qualification 1', bundle.event);
		const { red, blue } = match.result!;
		expect(text).toContain(`: blue (`);
		expect(text).toContain(`beat red (`);
		expect(text).toContain(`, ${blue.total}–${red.total}.`);
	});
});
