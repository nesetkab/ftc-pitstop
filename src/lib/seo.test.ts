import { describe, expect, it } from 'vitest';
import { fixtureBundle } from '#lib/components/event/test-fixtures.ts';
import {
	articleJsonLd,
	breadcrumbs,
	eventDescription,
	eventJsonLd,
	jsonLdScript,
	matchDescription,
	regionDescription,
	regionTitle,
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
			sections: ['aOPR', 'Glossary']
		});
		expect(data).toMatchObject({
			'@type': 'TechArticle',
			headline: 'About the numbers',
			url: `${ORIGIN}/about`,
			articleSection: ['aOPR', 'Glossary'],
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

	it('names a team with its place, season aOPR and world rank', () => {
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
			'FTC team 724 RedNek Robotics Wun from Sun River, Montana. 2026-27 BIOBUZZ aOPR 57.2, 201st of 3,871 teams worldwide. Qualification record 4-1-0 across 1 event. Match history, aOPR by part and awards.'
		);
	});

	it('leaves out stats a team does not have yet', () => {
		expect(
			teamDescription(
				{ ...team, place: '' },
				{ opr: null, rank: null, of: null, record: null, events: 0 }
			)
		).toBe('FTC team 724 RedNek Robotics Wun. Match history, aOPR by part and awards.');
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

	it('titles and describes a region page', () => {
		expect(regionTitle('Arizona')).toBe('Arizona FTC region, 2026-27 BIOBUZZ - PitStop');
		const top = { team: 18420, name: 'Metal Masters', opr: 75.21 };
		expect(regionDescription({ name: 'Arizona', teams: 101, events: 14, done: 3, top })).toBe(
			'The Arizona FTC region in the 2026-27 BIOBUZZ season: 14 events, 3 played, 101 teams. Top team by aOPR is 18420 Metal Masters at 75.2. Top teams, live and upcoming events, advancement and the best scores.'
		);
		expect(regionDescription({ name: 'Wyoming', teams: 1, events: 1, done: 0, top: null })).toBe(
			'The Wyoming FTC region in the 2026-27 BIOBUZZ season: 1 event, 0 played, 1 team. Top teams, live and upcoming events, advancement and the best scores.'
		);
	});
});
