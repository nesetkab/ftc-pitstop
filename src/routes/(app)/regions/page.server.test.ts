import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeasonRatings } from '#lib/analysis/types.ts';
import { buildAdvancementIndex } from '#lib/components/advancement/advancement.ts';
import type { RankedStrength, Rosters } from '#lib/components/event/strength.ts';
import type { RecordRow } from '#lib/components/records/records.ts';
import type { RegionSummary } from '#lib/components/region/regions.ts';
import { eventSummary } from '#lib/components/team/fixtures.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { RegionPage } from '#lib/server/regions.ts';
import type { EventSummary } from '#lib/types.ts';
import { load as listLoad } from './+page.server.ts';
import { load as regionLoad } from './[code]/+page.server.ts';

const NOW = Date.parse('2026-11-21T20:00:00Z');

const server = vi.hoisted(() => ({
	loadSeasonEvents: vi.fn(),
	searchIndex: vi.fn(),
	finishedEvents: vi.fn(),
	loadRosters: vi.fn(),
	loadSeasonRatings: vi.fn(),
	loadStrength: vi.fn(),
	loadAdvancement: vi.fn(),
	loadRecordDataset: vi.fn()
}));

vi.mock('#lib/server/event.ts', () => ({
	loadSeasonEvents: server.loadSeasonEvents,
	searchIndex: server.searchIndex,
	finishedEvents: server.finishedEvents
}));
vi.mock('#lib/server/rosters.ts', () => ({ loadRosters: server.loadRosters }));
vi.mock('#lib/server/analysis.ts', () => ({ loadSeasonRatings: server.loadSeasonRatings }));
vi.mock('#lib/server/strength.ts', () => ({ loadStrength: server.loadStrength }));
vi.mock('#lib/server/advancement.ts', () => ({ loadAdvancement: server.loadAdvancement }));
vi.mock('#lib/server/records.ts', () => ({ loadRecordDataset: server.loadRecordDataset }));

const events: EventSummary[] = [
	eventSummary({ code: 'USAZGIQ', start: '2026-11-14', end: '2026-11-14' }),
	eventSummary({
		code: 'USAZLM',
		name: 'Phoenix League Meet',
		type: 'LeagueMeet',
		start: '2026-11-21',
		end: '2026-11-21'
	}),
	eventSummary({
		code: 'USAZFLQ',
		name: 'Flagstaff Qualifier',
		start: '2026-12-05',
		end: '2026-12-05'
	}),
	eventSummary({
		code: 'USAZCMP',
		name: 'Arizona Championship',
		type: 'Championship',
		start: '2027-02-20',
		end: '2027-02-21'
	}),
	eventSummary({
		code: 'USAZKICK',
		name: 'Arizona Kickoff',
		type: 'Kickoff',
		start: '2026-09-12',
		end: '2026-09-12'
	}),
	eventSummary({
		code: 'USCALAQ',
		name: 'Los Angeles Qualifier',
		region: 'USCALA',
		city: 'Los Angeles',
		state: 'CA',
		timezone: 'America/Los_Angeles'
	}),
	eventSummary({
		code: 'CAONQ',
		name: 'Toronto Qualifier',
		region: 'CAON',
		city: 'Toronto',
		state: 'ON',
		country: 'Canada',
		timezone: 'America/Toronto'
	})
];

function rating(team: number, opr: number, region: string | null, matches = 10) {
	return {
		team,
		opr,
		parts: { auto: 30, hive: 80, flower: 10, garden: 10, park: 10, tips: 4 },
		matches,
		events: 1,
		rank: 0,
		percentile: 50,
		region
	};
}

const ratings: SeasonRatings = {
	generatedAt: NOW - 3_600_000,
	teams: [
		{ ...rating(103, 160, 'USCALA'), rank: 1 },
		{ ...rating(101, 150, 'USAZ'), rank: 2 },
		{ ...rating(102, 120, 'USAZ'), rank: 3 },
		{ ...rating(104, 90, 'USAZ', 0), rank: 4 },
		{ ...rating(105, 80, null), rank: 5 },
		{ ...rating(109, 70, 'CAON'), rank: 6 }
	]
};

const rosters: Rosters = {
	USAZGIQ: { registered: [101, 102, 106], played: [101, 102] },
	USAZLM: { registered: [101, 107], played: [] },
	USAZFLQ: { registered: [102, 108], played: [] },
	USCALAQ: { registered: [103], played: [103] },
	CAONQ: { registered: [109], played: [109] }
};

const teams = [
	{ number: 101, name: 'Desert Bots', city: 'Phoenix', state: 'AZ', country: 'USA' },
	{ number: 102, name: 'Cactus Coders', city: 'Tempe', state: 'AZ', country: 'USA' },
	{ number: 103, name: 'LA Gears', city: 'Los Angeles', state: 'CA', country: 'USA' }
];

const strength: RankedStrength = {
	ratingsAt: ratings.generatedAt,
	total: 1,
	events: new Map([['USAZGIQ', { top: 88.5, deep: null, all: 70.1, rated: 2, teams: 3, rank: 1 }]])
};

const advancement = buildAdvancementIndex({
	events,
	results: {
		USAZGIQ: {
			code: 'USAZGIQ',
			advancesTo: 'USAZCMP',
			slots: 2,
			teams: [{ team: 101, name: 'Desert Bots', slot: 1, reasons: ['Inspire'] }],
			fetchedAt: NOW - 86_400_000
		}
	},
	now: NOW
});

function record(event: string, region: string, total: number, key: string): RecordRow {
	return {
		event,
		day: '2026-11-14',
		type: 'Qualifier',
		region,
		key,
		label: key.toUpperCase(),
		level: 'qual',
		alliance: 'red',
		teams: [101, 102],
		opponents: [106, 103],
		result: 'win',
		total,
		opponent: 90,
		auto: 40,
		teleop: total - 40,
		hive: 0,
		flower: 0,
		garden: 0,
		park: 0,
		tips: 0,
		fouls: 0,
		final: total,
		margin: total - 90
	};
}

const records = [
	record('USAZGIQ', 'USAZ', 190, 'q2'),
	record('USCALAQ', 'USCALA', 250, 'q1'),
	record('USAZGIQ', 'USAZ', 210, 'q7')
];

function listCall() {
	const setHeaders = vi.fn();
	const result = listLoad({ setHeaders } as never) as Promise<{ regions: RegionSummary[] }>;
	return { result, setHeaders };
}

function regionCall(code: string) {
	const setHeaders = vi.fn();
	const result = regionLoad({ params: { code }, setHeaders } as never) as Promise<RegionPage>;
	return { result, setHeaders };
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(NOW);
	server.loadSeasonEvents.mockResolvedValue({ events, fetchedAt: NOW, stale: false });
	server.searchIndex.mockResolvedValue({ teams, events, fetchedAt: NOW });
	server.finishedEvents.mockReturnValue([]);
	server.loadRosters.mockResolvedValue(rosters);
	server.loadSeasonRatings.mockResolvedValue(ratings);
	server.loadStrength.mockResolvedValue(strength);
	server.loadAdvancement.mockResolvedValue({ index: advancement, stale: false });
	server.loadRecordDataset.mockResolvedValue({
		dataset: { rows: records, regions: [], types: [] },
		updated: NOW
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.resetAllMocks();
});

describe('regions list', () => {
	it('counts teams, events played and left, and the top team for every region', async () => {
		const { result, setHeaders } = listCall();
		const { regions } = await result;
		const arizona = regions.find((region) => region.code === 'USAZ');
		expect(arizona).toMatchObject({
			name: 'Arizona',
			bucket: 'us',
			teams: 4,
			rated: 2,
			events: 4,
			done: 1,
			live: 1,
			upcoming: 2,
			top: { team: 101, name: 'Desert Bots', opr: 150, rank: 2 }
		});
		expect(regions.map((region) => [region.code, region.bucket])).toEqual([
			['USAZ', 'us'],
			['USCALA', 'us'],
			['CAON', 'canada']
		]);
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': CACHE_CONTROL.ratings });
	});

	it('lists regions before ratings exist and keeps the page briefly', async () => {
		server.loadSeasonRatings.mockResolvedValue(null);
		const { result, setHeaders } = listCall();
		const arizona = (await result).regions.find((region) => region.code === 'USAZ');
		expect(arizona).toMatchObject({ teams: 4, rated: 0, top: null });
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': CACHE_CONTROL.short });
	});

	it('leaves the team count unknown when no event in a region lists its teams', async () => {
		const known = Object.entries(rosters).filter(([code]) => code !== 'CAONQ');
		server.loadRosters.mockResolvedValue({
			...Object.fromEntries(known),
			USCALAQ: { registered: [], played: [] }
		});
		const { regions } = await listCall().result;
		const count = (code: string) => regions.find((region) => region.code === code)?.teams;
		expect([count('USAZ'), count('USCALA'), count('CAON')]).toEqual([4, null, null]);
	});

	it('asks for a retry when the event list is down', async () => {
		server.loadSeasonEvents.mockRejectedValue(new Error('offline'));
		await expect(listCall().result).rejects.toMatchObject({ status: 503 });
	});
});

describe('region page', () => {
	it('shows top teams, events by status, advancement and the best scores', async () => {
		const { result, setHeaders } = regionCall('USAZ');
		const page = await result;
		expect(page.teams.map((team) => [team.team, team.opr, team.rank, team.place])).toEqual([
			[101, 150, 2, 'Phoenix, AZ'],
			[102, 120, 3, 'Tempe, AZ']
		]);
		expect(page.events.live.map((event) => event.code)).toEqual(['USAZLM']);
		expect(page.events.upcoming.map((event) => event.code)).toEqual(['USAZFLQ', 'USAZCMP']);
		expect(page.events.done.map((event) => [event.code, event.teams, event.strength])).toEqual([
			['USAZGIQ', 2, 88.5]
		]);
		expect(page.advancement?.rows).toEqual([
			expect.objectContaining({ code: 'USAZCMP', advanced: 1, teams: [101] })
		]);
		expect(page.records?.map((row) => [row.total, row.rank])).toEqual([
			[210, 1],
			[190, 2]
		]);
		expect(page.names).toEqual({
			teams: { 101: 'Desert Bots', 102: 'Cactus Coders' },
			events: { USAZGIQ: 'Roadrunner - Gilbert Qualifier' }
		});
		expect(page.complete).toBe(true);
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': CACHE_CONTROL.ratings });
	});

	it('still renders when scores and strength are not ready, and keeps it briefly', async () => {
		server.loadRecordDataset.mockResolvedValue(null);
		server.loadStrength.mockRejectedValue(new Error('not ready'));
		const { result, setHeaders } = regionCall('USAZ');
		const page = await result;
		expect(page.records).toBeNull();
		expect(page.events.done[0].strength).toBeNull();
		expect(page.teams).toHaveLength(2);
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': CACHE_CONTROL.short });
	});

	it('moves lowercase codes to the canonical one', async () => {
		await expect(regionCall('usaz').result).rejects.toMatchObject({
			status: 308,
			location: '/regions/USAZ'
		});
	});

	it('answers 404 for codes no event uses', async () => {
		await expect(regionCall('USZZ').result).rejects.toMatchObject({ status: 404 });
		await expect(regionCall('US-AZ').result).rejects.toMatchObject({ status: 404 });
	});

	it('asks for a retry when the event list is down', async () => {
		server.loadSeasonEvents.mockRejectedValue(new Error('offline'));
		await expect(regionCall('USAZ').result).rejects.toMatchObject({ status: 503 });
	});
});
