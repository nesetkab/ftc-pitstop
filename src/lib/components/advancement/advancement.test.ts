import { describe, expect, it } from 'vitest';
import { fixtureBundle } from '#lib/components/pit/fixtures.ts';
import { eventSummary } from '#lib/components/team/fixtures.ts';
import type { Award, EventSummary } from '#lib/types.ts';
import {
	buildAdvancementIndex,
	championshipRow,
	eventResult,
	filterIndex,
	parseRegion,
	reasonFor,
	regionOptions,
	teamReasons,
	unpostedIn,
	type EventResult
} from './advancement.ts';

const NOW = Date.parse('2026-11-23T12:00:00Z');

function event(code: string, overrides: Partial<EventSummary>): EventSummary {
	return eventSummary({ code, name: code, ...overrides });
}

function result(code: string, advancesTo: string | null, teams: number[], slots = teams.length) {
	return {
		code,
		advancesTo,
		slots,
		teams: teams.map((team, index) => ({
			team,
			name: `Team ${team}`,
			slot: index + 1,
			reasons: []
		})),
		fetchedAt: NOW
	} satisfies EventResult;
}

const award = (id: number, name: string, placement: number, team: number): Award => ({
	id,
	name,
	placement,
	team,
	person: null
});

describe('advancement reasons', () => {
	it('names awards the short way', () => {
		expect(reasonFor(award(11, 'Inspire Award', 1, 1))).toBe('Inspire');
		expect(reasonFor(award(11, 'Inspire Award 2nd Place', 2, 1))).toBe('Inspire 2nd');
		expect(reasonFor(award(13, 'Winning Alliance - Captain', 1, 1))).toBe(
			'Winning alliance captain'
		);
		expect(reasonFor(award(12, 'Finalist Alliance - 1st Team Selected', 2, 1))).toBe(
			'Finalist alliance 1st pick'
		);
		expect(reasonFor(award(7, 'Innovate Award sponsored by RTX 2nd Place', 2, 1))).toBe(
			'Innovate 2nd'
		);
	});

	it('orders reasons by how many advancement points they carry', () => {
		const awards = [
			award(7, 'Innovate Award sponsored by RTX', 1, 5237),
			award(13, 'Winning Alliance - Captain', 1, 5237),
			award(11, 'Inspire Award 3rd Place', 3, 5237),
			{ ...award(2, "Dean's List Finalist", 1, 5237), person: 'Someone' }
		];
		expect(teamReasons(awards, 5237)).toEqual([
			'Winning alliance captain',
			'Inspire 3rd',
			'Innovate'
		]);
	});

	it('keeps only teams taking a new spot from a real event', () => {
		const bundle = fixtureBundle('USMINOQ');
		const names = new Map([[10137, 'Robo Bees']]);
		const entry = eventResult('USMINOQ', bundle.advancement!, bundle.awards, names, NOW);
		expect(entry.advancesTo).toBe('USMISECMP');
		expect(entry.slots).toBe(5);
		expect(entry.teams.map((team) => team.team)).toEqual([10137, 29694, 37709, 19940, 25721]);
		expect(entry.teams[0].name).toBe('Robo Bees');
		expect(entry.teams[1].name).toBeNull();
	});

	it('explains why each team advanced from the awards', () => {
		const bundle = fixtureBundle('USMISOQ');
		const entry = eventResult('USMISOQ', bundle.advancement!, bundle.awards, new Map(), NOW);
		const why = Object.fromEntries(entry.teams.map((team) => [team.team, team.reasons]));
		expect(why[34672]).toEqual(['Inspire']);
		expect(why[5237]).toEqual(['Winning alliance captain', 'Innovate']);
		expect(why[23392]).toEqual(['Finalist alliance 1st pick']);
	});

	it('skips declined and ineligible teams', () => {
		const bundle = fixtureBundle('USMTBUQ-final');
		const entry = eventResult('USMTBUQ', bundle.advancement!, [], new Map(), NOW);
		expect(entry.teams.map((team) => team.team)).not.toContain(5026);
		expect(entry.teams).toHaveLength(12);
	});
});

describe('advancement index', () => {
	const events = [
		event('USAZGIQ', { region: 'USAZ', start: '2026-11-14', end: '2026-11-14' }),
		event('USAZPHQ', { region: 'USAZ', start: '2026-12-05', end: '2026-12-05' }),
		event('USAZOLDQ', { region: 'USAZ', start: '2026-11-07', end: '2026-11-07' }),
		event('USAZCMP', {
			region: 'USAZ',
			type: 'Championship',
			name: 'Arizona Championship',
			start: '2027-02-26',
			end: '2027-02-27'
		}),
		event('USMINOQ', { region: 'USMI', start: '2026-11-21', end: '2026-11-21' }),
		event('USMIWQ', { region: 'USMI', start: '2026-12-01', end: '2026-12-01' }),
		event('USMINWCMP', {
			region: 'USMI',
			type: 'Championship',
			start: '2026-12-10',
			end: '2026-12-10'
		}),
		event('USMISECMP', {
			region: 'USMI',
			type: 'Championship',
			start: '2026-12-11',
			end: '2026-12-11'
		}),
		event('USNYNYQ', { region: 'USNYNY', start: '2026-12-12', end: '2026-12-12' }),
		event('USNYNYSQ', {
			region: 'USNYNY',
			type: 'SuperQualifier',
			start: '2027-02-20',
			end: '2027-02-20'
		}),
		event('USNYNYCMP', {
			region: 'USNYNY',
			type: 'Championship',
			start: '2027-03-07',
			end: '2027-03-07'
		}),
		event('KZQ', { region: 'KZ', start: '2026-11-01', end: '2026-11-01' }),
		event('KZQ2', { region: 'KZ', start: '2026-12-20', end: '2026-12-20' }),
		event('USAZMEET', {
			region: 'USAZ',
			type: 'LeagueMeet',
			start: '2026-11-10',
			end: '2026-11-10'
		}),
		event('FTCCMP1', {
			region: 'CMPZ2',
			type: 'FIRSTChampionship',
			name: 'FIRST Championship',
			start: '2027-04-28',
			end: '2027-05-01'
		})
	];
	const results = {
		USAZGIQ: result('USAZGIQ', 'USAZCMP', [25620, 18420]),
		USMINOQ: result('USMINOQ', 'USMISECMP', [10137, 29694]),
		KZQ: result('KZQ', null, [])
	};
	const index = buildAdvancementIndex({ events, results, now: NOW });
	const find = (code: string) => index.championships.find((entry) => entry.code === code);

	it('lists teams under the championship their event sends them to', () => {
		const arizona = find('USAZCMP')!;
		expect(arizona.teams.map((team) => [team.team, team.event])).toEqual([
			[25620, 'USAZGIQ'],
			[18420, 'USAZGIQ']
		]);
		expect(find('USMISECMP')!.teams.map((team) => team.team)).toEqual([10137, 29694]);
	});

	it('shows events still to play, guessing the destination only when the region allows one', () => {
		const arizona = find('USAZCMP')!;
		expect(arizona.feeders.map((feeder) => [feeder.code, feeder.state, feeder.confirmed])).toEqual([
			['USAZOLDQ', 'pending', false],
			['USAZGIQ', 'done', true],
			['USAZPHQ', 'upcoming', false]
		]);
		expect(find('USMISECMP')!.feeders.map((feeder) => feeder.code)).toEqual(['USMINOQ']);
		expect(index.unassigned.map((feeder) => feeder.code)).toContain('USNYNYQ');
	});

	it('sends a lone super qualifier to its region and championships to the FIRST Championship', () => {
		expect(find('USNYNYCMP')!.feeders.map((feeder) => feeder.code)).toEqual(['USNYNYSQ']);
		const world = find('FTCCMP1')!;
		expect(world.level).toBe('world');
		expect(world.feeders.map((feeder) => feeder.code)).toContain('USAZCMP');
		expect(find('USAZCMP')!.advancesTo).toBe('FTCCMP1');
		expect(index.championships.at(-1)!.code).toBe('FTCCMP1');
	});

	it('does not guess when a region has more than one place to send teams', () => {
		expect(index.unassigned.map((feeder) => feeder.code)).toContain('USMIWQ');
		expect(find('USMISECMP')!.feeders.map((feeder) => feeder.code)).not.toContain('USMIWQ');
		expect(find('USNYNYSQ')).toBeUndefined();
	});

	it('learns the destination from other events in the same region', () => {
		const learned = buildAdvancementIndex({
			events: [
				event('USCOAQ', { region: 'USCO', end: '2026-11-14' }),
				event('USCOBQ', { region: 'USCO', start: '2026-12-12', end: '2026-12-12' })
			],
			results: { USCOAQ: result('USCOAQ', 'USCOCMP', [1]) },
			now: NOW
		});
		const colorado = learned.championships.find((entry) => entry.code === 'USCOCMP')!;
		expect(colorado.name).toBe('USCOCMP');
		expect(colorado.feeders.map((feeder) => [feeder.code, feeder.confirmed])).toEqual([
			['USCOAQ', true],
			['USCOBQ', false]
		]);
	});

	it('leaves out regions whose events do not advance and non-advancing event types', () => {
		const codes = [
			...index.championships.flatMap((entry) => entry.feeders.map((feeder) => feeder.code)),
			...index.unassigned.map((feeder) => feeder.code)
		];
		expect(codes).not.toContain('KZQ');
		expect(codes).not.toContain('KZQ2');
		expect(codes).not.toContain('USAZMEET');
	});

	it('counts each team once per championship, at its first event', () => {
		const twice = buildAdvancementIndex({
			events,
			results: {
				USAZGIQ: result('USAZGIQ', 'USAZCMP', [25620]),
				USAZOLDQ: result('USAZOLDQ', 'USAZCMP', [25620])
			},
			now: NOW
		});
		const teams = twice.championships.find((entry) => entry.code === 'USAZCMP')!.teams;
		expect(teams.map((team) => [team.team, team.event])).toEqual([[25620, 'USAZOLDQ']]);
	});

	it('summarizes a championship for the overview', () => {
		const row = championshipRow(find('USAZCMP')!);
		expect(row).toMatchObject({ advanced: 2, played: 2, feeders: 3, pending: 1 });
		expect(row.next).toEqual({ code: 'USAZPHQ', name: 'USAZPHQ', start: '2026-12-05' });
		expect(row.teams).toEqual([25620, 18420]);
	});
});

describe('advancement filters', () => {
	const events = [
		event('USAZGIQ', { region: 'USAZ', end: '2026-11-14' }),
		event('USAZCMP', {
			region: 'USAZ',
			type: 'Championship',
			start: '2027-02-26',
			end: '2027-02-26'
		}),
		event('USUTQ', { region: 'USUT', start: '2026-12-05', end: '2026-12-05' }),
		event('USUTCMP', {
			region: 'USUT',
			type: 'Championship',
			start: '2027-02-26',
			end: '2027-02-26'
		}),
		event('FTCCMP1', {
			region: 'CMPZ2',
			type: 'FIRSTChampionship',
			start: '2027-04-28',
			end: '2027-04-28'
		})
	];
	const index = buildAdvancementIndex({
		events,
		results: { USAZGIQ: result('USAZGIQ', 'USAZCMP', [25620]) },
		now: NOW
	});

	it('keeps one region and its share of the FIRST Championship', () => {
		const utah = filterIndex(index, 'USUT');
		expect(utah.championships.map((entry) => entry.code)).toEqual(['USUTCMP', 'FTCCMP1']);
		const world = utah.championships[1];
		expect(world.feeders.map((feeder) => feeder.code)).toEqual(['USUTCMP']);
		expect(filterIndex(index, null)).toBe(index);
	});

	it('offers regions that have championships or feeder events', () => {
		expect(regionOptions(index).map((option) => option.value)).toEqual(['USAZ', 'USUT']);
		expect(regionOptions(index)[0].label).toBe('Arizona');
	});

	it('accepts only region codes', () => {
		expect(parseRegion(' usmi ')).toBe('USMI');
		expect(parseRegion('<script>')).toBeNull();
		expect(parseRegion(null)).toBeNull();
	});
});

describe('advancement gaps', () => {
	const events = [
		event('USMIAQ', { region: 'USMI', end: '2026-11-21' }),
		event('USMIBQ', { region: 'USMI', start: '2026-12-04', end: '2026-12-05' }),
		event('USMINWCMP', {
			region: 'USMI',
			type: 'Championship',
			start: '2026-12-10',
			end: '2026-12-10'
		}),
		event('USMISECMP', {
			region: 'USMI',
			type: 'Championship',
			start: '2026-12-11',
			end: '2026-12-11'
		})
	];
	const index = buildAdvancementIndex({
		events,
		results: { USMIAQ: result('USMIAQ', 'USMISECMP', [], 0) },
		now: NOW
	});
	const southeast = index.championships.find((entry) => entry.code === 'USMISECMP')!;

	it('treats an advancement list with no spots yet as results still to come', () => {
		expect(southeast.feeders.map((feeder) => [feeder.code, feeder.state])).toEqual([
			['USMIAQ', 'pending']
		]);
	});

	it('counts upcoming events in the region whose destination is not posted', () => {
		expect(unpostedIn(index, southeast)).toBe(1);
		expect(championshipRow(southeast, unpostedIn(index, southeast))).toMatchObject({
			unposted: 1,
			next: null,
			pending: 1
		});
	});
});
