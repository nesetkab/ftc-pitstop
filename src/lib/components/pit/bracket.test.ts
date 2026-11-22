import { describe, expect, it } from 'vitest';
import { replayBundle, replayStart } from '#lib/game/replay.ts';
import type { EventBundle, Match } from '#lib/types.ts';
import { fillPlayoffs } from './bracket.ts';
import { fixtureBundle } from './fixtures.ts';

const full = fixtureBundle('USAZGIQ');

function complete(bundle: EventBundle): Match[] {
	return bundle.matches.filter((match) => match.red.length > 0 && match.blue.length > 0);
}

function playoffs(matches: Match[]): string[] {
	return matches
		.filter((match) => match.level === 'playoff')
		.map((match) => `${match.label} ${match.red.length}-${match.blue.length}`);
}

describe('fillPlayoffs', () => {
	it('adds bracket matches the schedule has not listed yet', () => {
		const bundle = replayBundle(full, replayStart('M3', full)!);
		const filled = fillPlayoffs(complete(bundle), bundle.alliances);
		expect(playoffs(filled.matches)).toEqual([
			'M1 2-2',
			'M2 2-2',
			'M3 2-2',
			'M4 2-2',
			'M5 2-2',
			'M6 0-2',
			'M7 2-0'
		]);
		const m7 = filled.matches.find((match) => match.key === 'p7')!;
		expect(m7.red.map((slot) => slot.team)).toEqual([26670, 18421]);
		expect(m7.description).toBe('Upper Bracket Round 4 Match 7');
		expect(filled.pending.get('p7')).toEqual({ blue: 'Winner of M4' });
		expect(filled.pending.get('p6')).toEqual({ red: 'Loser of M4' });
	});

	it('fills an empty side of a listed match', () => {
		const bundle = replayBundle(full, replayStart('M3', full)!);
		const listed = bundle.matches.find((match) => match.key === 'p7')!;
		expect(listed.blue).toEqual([]);
		const blank = bundle.matches.map((match) =>
			match.key === 'p7' ? { ...match, red: [], blue: [] } : match
		);
		const filled = fillPlayoffs(blank, bundle.alliances);
		const m7 = filled.matches.find((match) => match.key === 'p7')!;
		expect(m7.scheduledTime).toBe(listed.scheduledTime);
		expect(m7.red.map((slot) => slot.team)).toEqual([26670, 18421]);
		expect(m7.blue).toEqual([]);
	});

	it('adds a tiebreaker after a tied final', () => {
		const event = fixtureBundle('USMINOQ');
		const tied = replayBundle(event, replayStart('M10', event)!);
		const filled = fillPlayoffs(
			tied.matches.filter((match) => match.key !== 'p10-2'),
			tied.alliances
		);
		const replay = filled.matches.find((match) => match.key === 'p10-2')!;
		expect(replay.label).toBe('M10-2');
		expect(replay.red.map((slot) => slot.team)).toEqual([10137, 11129]);
		expect(replay.blue.map((slot) => slot.team)).toEqual([21331, 8533]);
	});

	it('adds the deciding final at a two-alliance event', () => {
		const event = fixtureBundle('USALATQ');
		const swapped = event.matches.map((match) =>
			match.key === 'p1' && match.result
				? { ...match, result: { ...match.result, winner: 'blue' as const } }
				: match
		);
		const filled = fillPlayoffs(swapped, event.alliances);
		expect(filled.matches.at(-1)).toMatchObject({ key: 'p3', label: 'F3' });
		expect(fillPlayoffs(event.matches, event.alliances).matches).toBe(event.matches);
	});

	it('leaves brackets it does not recognize alone', () => {
		const bundle = replayBundle(full, replayStart('M3', full)!);
		const odd = bundle.alliances.map((alliance) =>
			alliance.seed === 1
				? { ...alliance, seed: 2 }
				: alliance.seed === 2
					? { ...alliance, seed: 1 }
					: alliance
		);
		const matches = complete(bundle);
		expect(fillPlayoffs(matches, odd).matches).toBe(matches);
		expect(fillPlayoffs(matches, []).matches).toBe(matches);
	});
});
