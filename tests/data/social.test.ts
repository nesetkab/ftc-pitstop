import { describe, expect, it } from 'vitest';
import { ogImagePath, withSocialTags } from '#lib/server/social.ts';

const page = (head: string) => `<!doctype html><html><head>${head}</head><body></body></html>`;

describe('share previews', () => {
	it('picks the card that matches the page', () => {
		const image = (path: string) => ogImagePath(new URL(path, 'https://www.ftcpitstop.com'));
		expect(image('/teams/3747')).toBe('/og/teams/3747.png');
		expect(image('/3747')).toBe('/og/teams/3747.png');
		expect(image('/3747/tv')).toBe('/og/teams/3747.png');
		expect(image('/events/usmtbuq/rankings')).toBe('/og/events/USMTBUQ.png');
		expect(image('/events/USMTBUQ/matches/Q12')).toBe('/og/events/USMTBUQ/matches/q12.png');
		expect(image('/events/USMTBUQ/matches/p3-2')).toBe('/og/events/USMTBUQ/matches/p3-2.png');
		expect(image('/')).toBe('/og/site.png');
		expect(image('/w/ABC234/picklist')).toBe('/og/workspace.png');
		expect(image('/leaderboards?region=USUT')).toBe('/og/leaderboards.png');
		expect(image('/records')).toBe('/og/records.png');
		expect(image('/events')).toBe('/og/events.png');
		expect(image('/accuracy')).toBe('/og/accuracy.png');
		expect(image('/advancement?region=USMI')).toBe('/og/advancement.png');
		expect(image('/advancement/USMISECMP')).toBe('/og/advancement.png');
		expect(image('/compare?teams=16,724,16')).toBe('/og/compare/16-724.png');
		expect(image('/compare?teams=16')).toBe('/og/compare.png');
		expect(image('/compare')).toBe('/og/compare.png');
		expect(image('/simulate?red=724,10662&blue=5026,4133')).toBe(
			'/og/simulate/724-10662-vs-5026-4133.png'
		);
		expect(image('/simulate?red=724,10662&blue=5026')).toBe('/og/simulate.png');
		expect(image('/simulate?red=724,10662&blue=724,4133')).toBe('/og/simulate.png');
		expect(image('/simulate')).toBe('/og/simulate.png');
	});

	it('uses the canonical compare order for the image', () => {
		const html = withSocialTags(
			page(
				'<title>Compare</title><link rel="canonical" href="https://www.ftcpitstop.com/compare?teams=16,724">'
			),
			new URL('https://www.ftcpitstop.com/compare?teams=724,16')
		);
		expect(html).toContain('content="https://www.ftcpitstop.com/og/compare/16-724.png"');
	});

	it('describes the pit views that have no description of their own', () => {
		const html = withSocialTags(
			page('<title>3747 pit display - PitStop</title>'),
			new URL('https://www.ftcpitstop.com/3747/tv')
		);
		expect(html).toMatch(/<meta name="description" content="Pit display for FTC team 3747: [^"]+"/);
		expect(html).toMatch(/<meta property="og:description" content="Pit display for FTC team 3747/);
		expect(html).toContain('<meta property="og:image:alt" content="3747 pit display - PitStop" />');
		expect(html.match(/name="description"/g)).toHaveLength(1);
	});

	it('adds preview tags from the page title and description', () => {
		const html = withSocialTags(
			page('<title>3747 "The Hive" - PitStop</title><meta name="description" content="Season stats" />'),
			new URL('https://www.ftcpitstop.com/teams/3747?tab=events')
		);
		expect(html).toContain('<meta property="og:title" content="3747 &quot;The Hive&quot; - PitStop" />');
		expect(html).toContain('<meta property="og:description" content="Season stats" />');
		expect(html).toContain('<meta property="og:url" content="https://www.ftcpitstop.com/teams/3747" />');
		expect(html).toContain(
			'<meta property="og:image" content="https://www.ftcpitstop.com/og/teams/3747.png" />'
		);
		expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
		expect(html.indexOf('og:image')).toBeLessThan(html.indexOf('</head>'));
	});

	it('points og:url at the canonical page when there is one', () => {
		const html = withSocialTags(
			page(
				'<title>Compare</title><link rel="canonical" href="https://www.ftcpitstop.com/compare?teams=16,724">'
			),
			new URL('https://www.ftcpitstop.com/compare?teams=724,16')
		);
		expect(html).toContain(
			'<meta property="og:url" content="https://www.ftcpitstop.com/compare?teams=16,724" />'
		);
		expect(html).toContain('<meta name="twitter:title" content="Compare" />');
	});

	it('leaves chunks without a head and pages that already have tags alone', () => {
		const url = new URL('https://www.ftcpitstop.com/');
		expect(withSocialTags('<div>body chunk</div>', url)).toBe('<div>body chunk</div>');
		const tagged = withSocialTags(page('<title>PitStop</title>'), url);
		expect(withSocialTags(tagged, url)).toBe(tagged);
		expect(tagged).not.toContain('og:description');
		const described = withSocialTags(
			page('<title>PitStop</title><meta name="description" content="Season stats" />'),
			url
		);
		expect(described.match(/name="description"/g)).toHaveLength(1);
	});
});
