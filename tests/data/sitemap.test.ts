import { describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
	searchIndex: vi.fn(async () => ({
		teams: [{ number: 3747 }, { number: 14624 }],
		events: [
			{ code: 'USMTBUQ', end: '2025-11-22' },
			{ code: 'USWAFUTURE', end: '2999-01-01' }
		],
		fetchedAt: 1
	}))
}));

vi.mock('#lib/server/event.ts', () => ({ searchIndex: server.searchIndex }));

const { GET } = await import('../../src/routes/sitemap.xml/+server.ts');

function get() {
	return GET({ url: new URL('https://www.ftcpitstop.com/sitemap.xml') } as never);
}

describe('sitemap', () => {
	it('lists the main pages, every event and every team', async () => {
		const response = await get();
		const xml = await response.text();
		expect(response.headers.get('content-type')).toContain('application/xml');
		expect(response.headers.get('cache-control')).toContain('s-maxage=86400');
		const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
		expect(locations).toEqual([
			'https://www.ftcpitstop.com/',
			'https://www.ftcpitstop.com/events',
			'https://www.ftcpitstop.com/leaderboards',
			'https://www.ftcpitstop.com/records',
			'https://www.ftcpitstop.com/accuracy',
			'https://www.ftcpitstop.com/about',
			'https://www.ftcpitstop.com/events/USMTBUQ',
			'https://www.ftcpitstop.com/events/USWAFUTURE',
			'https://www.ftcpitstop.com/teams/3747',
			'https://www.ftcpitstop.com/teams/14624'
		]);
	});

	it('dates finished events by their last day and leaves the rest undated', async () => {
		const xml = await (await get()).text();
		expect(xml).toContain(
			'<url><loc>https://www.ftcpitstop.com/events/USMTBUQ</loc><lastmod>2025-11-22</lastmod></url>'
		);
		expect(xml).toContain('<url><loc>https://www.ftcpitstop.com/events/USWAFUTURE</loc></url>');
		expect(xml).not.toContain('/compare');
	});

	it('still answers with the main pages when the lists are down', async () => {
		server.searchIndex.mockRejectedValueOnce(new Error('offline'));
		const response = await get();
		const xml = await response.text();
		expect(response.headers.get('cache-control')).toBe('public, s-maxage=300');
		expect(xml.match(/<loc>/g)).toHaveLength(6);
	});
});
