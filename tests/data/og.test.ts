import { describe, expect, it, vi } from 'vitest';
import { notFound } from '#lib/server/errors.ts';
import { siteCard, teamCard, type OgNode } from '#lib/server/og/cards.ts';
import { cardFor, eventStats, teamStats, type OgDeps } from '#lib/server/og/load.ts';
import { logoSvg } from '#lib/server/og/logo.ts';
import type { EventBundle, TeamSeason } from '#lib/types.ts';

vi.mock('#lib/server/event.ts', () => ({
	loadTeamSeason: async () => null,
	loadEventBundle: async () => {
		throw new Error('offline');
	}
}));
vi.mock('#lib/server/analysis.ts', () => ({ loadSeasonRatingsWithin: async () => null }));

const { GET } = await import('../../src/routes/og/[...path]/+server.ts');

function season(played: { wins: number; losses: number; ties: number }[] = []): TeamSeason {
	return {
		team: {
			number: 3747,
			name: 'The Hive',
			fullName: null,
			school: null,
			city: 'Sandy',
			state: 'UT',
			country: 'USA',
			rookieYear: 2009
		},
		events: [
			...played.map((stats) => ({ event: {}, stats, awards: [] })),
			{ event: {}, stats: null, awards: [] }
		],
		quickStats: null,
		previousQuickStats: null,
		fetchedAt: 0,
		stale: false
	} as unknown as TeamSeason;
}

const ratings = {
	generatedAt: 0,
	teams: [
		{ team: 99, rank: 1, opr: 120 },
		{ team: 3747, rank: 1787, opr: 61.25 }
	]
} as never;

function bundle(phase: EventBundle['phase'], played: number, total = 4): EventBundle {
	return {
		event: {
			code: 'USMTBUQ',
			name: 'Montana Qualifier',
			typeName: 'Qualifier',
			city: 'Butte',
			state: 'MT',
			country: 'USA',
			timezone: 'America/Denver',
			start: '2026-11-20',
			end: '2026-11-21'
		},
		teams: [{ number: 3747 }, { number: 14624 }],
		matches: Array.from({ length: total }, (_, index) => ({
			key: `q${index + 1}`,
			level: 'qual',
			result: index < played ? {} : null
		})),
		phase
	} as unknown as EventBundle;
}

function deps(overrides: Partial<OgDeps> = {}): OgDeps {
	return {
		loadTeamSeason: async () => season([{ wins: 4, losses: 1, ties: 0 }]),
		loadSeasonRatings: async () => ratings,
		loadEventBundle: async () => bundle('quals', 3),
		...overrides
	};
}

function walk(node: OgNode, visit: (node: OgNode) => void) {
	visit(node);
	for (const child of node.props.children ?? []) {
		if (child && typeof child === 'object') walk(child, visit);
	}
}

function texts(node: OgNode): string[] {
	const found: string[] = [];
	walk(node, (current) => {
		for (const child of current.props.children ?? []) if (typeof child === 'string') found.push(child);
	});
	return found;
}

describe('preview card data', () => {
	it('shows OPR, world rank and record for a rated team', () => {
		expect(teamStats(season([{ wins: 4, losses: 1, ties: 0 }]), ratings)).toEqual([
			{ label: 'OPR', value: '61.3' },
			{ label: 'World rank of 2', value: '1,787th' },
			{ label: 'Record', value: '4-1-0' }
		]);
	});

	it('falls back to events and rookie year before a team has played', () => {
		expect(teamStats(season(), null)).toEqual([
			{ label: 'Event this season', value: '1' },
			{ label: 'Rookie year', value: '2009' }
		]);
	});

	it('describes where an event is in its day', () => {
		const status = (event: EventBundle) => eventStats(event)[2];
		expect(status(bundle('upcoming', 0, 0))).toEqual({ label: 'Status', value: 'Upcoming' });
		expect(status(bundle('upcoming', 0))).toEqual({ label: 'Status', value: 'Schedule out' });
		expect(status(bundle('quals', 3))).toEqual({ label: 'Live now', value: 'Q3 of 4' });
		expect(status(bundle('selection', 4))).toEqual({ label: 'Live now', value: 'Selection' });
		expect(status(bundle('playoffs', 4))).toEqual({ label: 'Live now', value: 'Playoffs' });
		expect(status(bundle('done', 4))).toEqual({ label: 'Status', value: 'Finished' });
		expect(eventStats(bundle('quals', 3)).slice(0, 2)).toEqual([
			{ label: 'Teams', value: '2' },
			{ label: 'Event type', value: 'Qualifier' }
		]);
	});
});

describe('preview card routing', () => {
	it('builds team, event and site cards from their paths', async () => {
		const team = await cardFor('teams/3747.png', 'www.ftcpitstop.com', deps());
		expect(team?.maxAge).toBe(3600);
		expect(texts(team!.node)).toEqual(
			expect.arrayContaining(['ftcpitstop.com', '3747', 'The Hive', 'Sandy, Utah', '61.3'])
		);
		const event = await cardFor('events/USMTBUQ.png', 'www.ftcpitstop.com', deps());
		expect(event?.maxAge).toBe(120);
		expect(texts(event!.node)).toEqual(
			expect.arrayContaining(['Montana Qualifier', 'Butte, Montana · November 20 and 21, 2026'])
		);
		expect((await cardFor('site.png', 'www.ftcpitstop.com', deps()))?.maxAge).toBe(86_400);
	});

	it('refuses paths it does not know', async () => {
		for (const path of ['teams/0.png', 'teams/123456.png', 'events/usmtbuq.png', 'x.png', '']) {
			expect(await cardFor(path, 'www.ftcpitstop.com', deps())).toBeNull();
		}
	});

	it('answers missing events with no card and slow ones with the site card', async () => {
		const missing = deps({
			loadEventBundle: async () => {
				throw notFound('Event not found');
			}
		});
		expect(await cardFor('events/USXXQ.png', 'ftcpitstop.com', missing)).toBeNull();
		const slow = deps({ loadEventBundle: () => new Promise(() => {}) });
		const card = await cardFor('events/USMTBUQ.png', 'ftcpitstop.com', slow, 10);
		expect(card?.maxAge).toBe(60);
	});

	it('still draws a team card when the team cannot be loaded', async () => {
		const card = await cardFor('teams/3747.png', 'ftcpitstop.com', deps({ loadTeamSeason: async () => null }));
		expect(card?.maxAge).toBe(300);
		expect(texts(card!.node)).toContain('FTC team');
	});
});

describe('preview card layout', () => {
	it('gives every box with several children a flex layout', () => {
		const nodes = [
			siteCard('ftcpitstop.com'),
			teamCard({ number: 3747, name: 'The Hive', place: 'Sandy, Utah', stats: [] }, 'ftcpitstop.com')
		];
		for (const node of nodes) {
			walk(node, (current) => {
				if ((current.props.children ?? []).length > 1) expect(current.props.style?.display).toBe('flex');
			});
		}
	});

	it('turns the site logo into standalone SVG', () => {
		const svg = logoSvg('#efefec');
		expect(svg.startsWith('<svg')).toBe(true);
		expect(svg.endsWith('</svg>')).toBe(true);
		expect(svg).not.toMatch(/[{}]|currentColor|style:/);
		expect(svg).toContain('id="fade"');
		expect(svg).toContain('url(#wheel)');
	});

	it('serves a PNG with cache headers', async () => {
		const response = await GET({
			params: { path: 'site.png' },
			url: new URL('https://www.ftcpitstop.com/og/site.png')
		} as never);
		const bytes = new Uint8Array(await response.arrayBuffer());
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(response.headers.get('cache-control')).toContain('s-maxage=86400');
		expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
	});
});
