import { describe, expect, it, vi } from 'vitest';
import type { Sides, Simulation } from '#lib/components/simulate/simulate.ts';
import { notFound } from '#lib/server/errors.ts';
import { compareCard, listCard, matchCard, pageCard, siteCard, teamCard, type OgNode } from '#lib/server/og/cards.ts';
import {
	accuracyStats,
	cardFor,
	eventStats,
	matchCardData,
	teamStats,
	type OgDeps
} from '#lib/server/og/load.ts';
import { logoSvg } from '#lib/server/og/logo.ts';
import type { EventBundle, Match, TeamSeason } from '#lib/types.ts';

vi.mock('#lib/server/event.ts', () => ({
	loadTeamSeason: async () => null,
	loadEventBundle: async () => {
		throw new Error('offline');
	},
	searchIndex: async () => {
		throw new Error('offline');
	}
}));
vi.mock('#lib/server/analysis.ts', () => ({
	loadSeasonRatingsWithin: async () => null,
	loadSeasonModelWithin: async () => null
}));

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
		{ team: 99, rank: 1, opr: 120, region: 'USUT', matches: 10 },
		{ team: 3747, rank: 1787, opr: 61.25, region: 'USMT', matches: 10 }
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
		teams: [
			{ number: 3747, name: 'The Hive' },
			{ number: 14624, name: 'Iron Bees' }
		],
		matches: Array.from({ length: total }, (_, index) => ({
			key: `q${index + 1}`,
			level: 'qual',
			number: index + 1,
			label: `Q${index + 1}`,
			description: `Qualification ${index + 1}`,
			scheduledTime: Date.parse('2026-11-21T16:00:00Z') + index * 420_000,
			red: [{ team: 3747 }],
			blue: [{ team: 14624 }],
			result:
				index < played
					? { red: { total: 61 }, blue: { total: 60 }, winner: 'red' }
					: null
		})),
		rankings: played > 0 ? [{ rank: 1, team: 14624 }] : [],
		awards: [],
		phase
	} as unknown as EventBundle;
}

function simulated(sides: Sides): Simulation {
	const side = (color: 'red' | 'blue', score: number) => ({
		color,
		teams: sides[color].map((number) => ({ number, name: number === 3747 ? 'The Hive' : null })),
		score
	});
	const alliance = (win: number) => ({ win });
	return {
		red: side('red', 151.4),
		blue: side('blue', 98.2),
		forecast: { red: alliance(0.81), blue: alliance(0.17), tie: 0.02 }
	} as unknown as Simulation;
}

function deps(overrides: Partial<OgDeps> = {}): OgDeps {
	return {
		loadTeamSeason: async () => season([{ wins: 4, losses: 1, ties: 0 }]),
		loadSeasonRatings: async () => ratings,
		loadEventBundle: async () => bundle('quals', 3),
		loadTopRecords: async () =>
			[{ rank: 1, event: 'USMTBUQ', teams: [3747, 14624], total: 288 }] as never,
		loadNames: async () => ({
			teams: { 99: 'Top Team', 3747: 'The Hive' },
			events: { USMTBUQ: 'Montana Qualifier' }
		}),
		loadSimulation: async (sides) => simulated(sides),
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
	it('shows aOPR, world rank and record for a rated team', () => {
		expect(teamStats(season([{ wins: 4, losses: 1, ties: 0 }]), ratings)).toEqual([
			{ label: 'Season aOPR', value: '61.3' },
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
		const status = (event: EventBundle) => eventStats(event)[1];
		expect(status(bundle('upcoming', 0, 0))).toEqual({ label: 'Status', value: 'Upcoming' });
		expect(status(bundle('upcoming', 0))).toEqual({ label: 'Status', value: 'Schedule out' });
		expect(status(bundle('quals', 3))).toEqual({ label: 'Live now', value: 'Q3 of 4' });
		expect(status(bundle('selection', 4))).toEqual({ label: 'Live now', value: 'Selection' });
		expect(status(bundle('playoffs', 4))).toEqual({ label: 'Live now', value: 'Playoffs' });
		expect(status(bundle('done', 4))).toEqual({ label: 'Status', value: 'Finished' });
		expect(eventStats(bundle('quals', 3))[0]).toEqual({ label: 'Teams', value: '2' });
	});

	it('names the leader, then the winners, and falls back to the event type', () => {
		const third = (event: EventBundle) => eventStats(event)[2];
		expect(third(bundle('upcoming', 0))).toEqual({ label: 'Event type', value: 'Qualifier' });
		expect(third(bundle('quals', 3))).toEqual({ label: 'Ranked 1st, Iron Bees', value: '14624' });
		const done = {
			...bundle('done', 4),
			awards: [
				{ id: 13, name: 'Winning Alliance', placement: 1, team: 3747, person: null },
				{ id: 13, name: 'Winning Alliance', placement: 1, team: 14624, person: null }
			]
		};
		expect(third(done)).toEqual({ label: 'Winning alliance', value: '3747 & 14624' });
	});

	it('shows the score and both alliances for a match', () => {
		const played = bundle('quals', 3);
		const data = matchCardData(played, played.matches[0] as Match);
		expect(data.title).toBe('Qualification 1');
		expect(data.alliances).toEqual([
			{ color: 'red', teams: [{ number: 3747, name: 'The Hive' }], score: 61, won: true },
			{ color: 'blue', teams: [{ number: 14624, name: 'Iron Bees' }], score: 60, won: false }
		]);
		expect(data.note).toBe('Red won by 1 point');
		const upcoming = matchCardData(played, played.matches[3] as Match);
		expect(upcoming.alliances[0].score).toBeNull();
		expect(upcoming.note).toBe('Scheduled for Nov 21 at 9:21 AM local time');
	});

	it('sums prediction accuracy across every replayed season', () => {
		const report = {
			chosen: { id: 'opr-map' },
			pooled: {
				train: { 'opr-map': { n: 300, brier: 0.2, accuracy: 0.7 } },
				test: { 'opr-map': { n: 100, brier: 0.1, accuracy: 0.8 } }
			}
		};
		expect(accuracyStats(report)).toEqual([
			{ label: 'Winners called', value: '72.5%' },
			{ label: 'Brier score', value: '0.175' },
			{ label: 'Matches replayed', value: '400' }
		]);
		expect(accuracyStats(null)).toEqual([]);
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
			expect.arrayContaining([
				'Montana Qualifier',
				'Qualifier in Butte, Montana · November 20 and 21, 2026'
			])
		);
		expect((await cardFor('site.png', 'www.ftcpitstop.com', deps()))?.maxAge).toBe(86_400);
	});

	it('builds match, list, compare and page cards', async () => {
		const live = Date.parse('2026-11-21T18:00:00Z');
		const host = 'www.ftcpitstop.com';
		const played = await cardFor('events/USMTBUQ/matches/q1.png', host, deps(), 4000, live);
		expect(played?.maxAge).toBe(21_600);
		expect(texts(played!.node)).toEqual(
			expect.arrayContaining(['Qualification 1', 'Montana Qualifier', '3747', '61', '60'])
		);
		const next = await cardFor('events/USMTBUQ/matches/q4.png', host, deps(), 4000, live);
		expect(next?.maxAge).toBe(120);
		expect(await cardFor('events/USMTBUQ/matches/q9.png', host, deps())).toBeNull();
		const leaders = await cardFor('leaderboards.png', host, deps());
		expect(texts(leaders!.node)).toEqual(
			expect.arrayContaining(['1', '99', 'Top Team', '120.0', '1787', '3747', 'The Hive'])
		);
		const records = await cardFor('records.png', host, deps());
		expect(texts(records!.node)).toEqual(
			expect.arrayContaining(['3747 & 14624', 'Montana Qualifier', '288'])
		);
		const compare = await cardFor('compare/3747-99.png', host, deps());
		expect(texts(compare!.node)).toEqual(expect.arrayContaining(['3747', '99', '61.3', '1st']));
		const simulate = await cardFor('simulate/3747-99-vs-16-724.png', host, deps());
		expect(simulate?.maxAge).toBe(3600);
		expect(texts(simulate!.node)).toEqual(
			expect.arrayContaining([
				'Match simulator',
				'3747 & 99 vs 16 & 724',
				'3747  99',
				'The Hive',
				'151',
				'98',
				'Predicted · Red wins 81%, Blue 17%, tie 2%'
			])
		);
		const loading = await cardFor(
			'simulate/3747-99-vs-16-724.png',
			host,
			deps({ loadSimulation: async () => null })
		);
		expect(loading?.maxAge).toBe(300);
		const accuracy = await cardFor('accuracy.png', host, deps());
		expect(texts(accuracy!.node)).toContain('Matches replayed');
		const region = await cardFor('regions/USMT.png', host, deps());
		expect(region?.maxAge).toBe(21_600);
		expect(texts(region!.node)).toEqual(
			expect.arrayContaining(['Montana · 1 team rated', '1', '3747', 'The Hive', '61.3'])
		);
		expect(texts(region!.node)).not.toContain('99');
		const quiet = await cardFor('regions/USWY.png', host, deps());
		expect(quiet?.maxAge).toBe(300);
		expect(texts(quiet!.node)).toContain('Wyoming FTC region');
		for (const path of ['events.png', 'compare.png', 'simulate.png', 'workspace.png', 'regions.png']) {
			expect((await cardFor(path, host, deps()))?.maxAge).toBe(86_400);
		}
	});

	it('refuses paths it does not know', async () => {
		for (const path of [
			'teams/0.png',
			'teams/123456.png',
			'events/usmtbuq.png',
			'events/USMTBUQ/matches/x1.png',
			'compare/3747.png',
			'regions/usmt.png',
			'compare/3747-3747.png',
			'simulate/3747-99-vs-16.png',
			'simulate/3747-99-vs-16-3747.png',
			'x.png',
			''
		]) {
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
		const host = 'ftcpitstop.com';
		const played = bundle('quals', 3);
		const nodes = [
			siteCard(host),
			teamCard({ number: 3747, name: 'The Hive', place: 'Sandy, Utah', stats: [] }, host),
			matchCard(matchCardData(played, played.matches[0] as Match), host),
			listCard(
				{ kicker: 'K', title: 'T', rows: [{ rank: '1', label: '3747', detail: null, value: '9' }] },
				host
			),
			pageCard({ kicker: 'K', title: 'T', subtitle: 'S', stats: [{ label: 'A', value: '1' }] }, host),
			compareCard(
				[
					{ number: 1, name: 'A', stats: [{ label: 'aOPR', value: '1' }] },
					{ number: 2, name: 'B', stats: [] }
				],
				host
			)
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
