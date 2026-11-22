import { describe, expect, it } from 'vitest';
import { ogImagePath, withSocialTags } from '#lib/server/social.ts';

const page = (head: string) => `<!doctype html><html><head>${head}</head><body></body></html>`;

describe('share previews', () => {
	it('picks the card that matches the page', () => {
		expect(ogImagePath('/teams/3747')).toBe('/og/teams/3747.png');
		expect(ogImagePath('/3747')).toBe('/og/teams/3747.png');
		expect(ogImagePath('/3747/tv')).toBe('/og/teams/3747.png');
		expect(ogImagePath('/events/usmtbuq/rankings')).toBe('/og/events/USMTBUQ.png');
		expect(ogImagePath('/')).toBe('/og/site.png');
		expect(ogImagePath('/w/ABC234/picklist')).toBe('/og/site.png');
		expect(ogImagePath('/leaderboards')).toBe('/og/site.png');
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
	});
});
