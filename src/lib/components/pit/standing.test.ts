import { describe, expect, it } from 'vitest';
import { replayBundle } from '#lib/game/replay.ts';
import { fixtureBundle } from './fixtures.ts';
import {
	lastMatch,
	moveText,
	parseRankMemory,
	postedQuals,
	rememberRank,
	type LastMatch
} from './standing.ts';
import { pitView } from './view.ts';

const TEAM = 14624;
const full = fixtureBundle('USAZGIQ');
const posted = (key: string) => full.matches.find((match) => match.key === key)!.postedTime!;
const view = (time: number) =>
	pitView({ bundle: replayBundle(full, time), analysis: null, queue: null, team: TEAM });

describe('rememberRank', () => {
	it('keeps the rank from before our latest result', () => {
		let memory = rememberRank(null, 2, 10);
		expect(memory).toEqual({ posted: 2, rank: 10, previous: null });
		memory = rememberRank(memory, 2, 12);
		expect(memory).toEqual({ posted: 2, rank: 12, previous: null });
		memory = rememberRank(memory, 3, 12);
		expect(memory).toEqual({ posted: 3, rank: 12, previous: 12 });
		memory = rememberRank(memory, 3, 8);
		expect(memory).toEqual({ posted: 3, rank: 8, previous: 12 });
		expect(rememberRank(memory, 3, 8)).toBe(memory);
	});

	it('starts over when it missed a result or went back in time', () => {
		const memory = { posted: 3, rank: 8, previous: 12 };
		expect(rememberRank(memory, 5, 4)).toEqual({ posted: 5, rank: 4, previous: null });
		expect(rememberRank(memory, 1, 20)).toEqual({ posted: 1, rank: 20, previous: null });
		expect(rememberRank(memory, 4, null)).toBe(memory);
		expect(rememberRank(null, 0, null)).toBeNull();
	});
});

describe('parseRankMemory', () => {
	it('reads saved memory and drops junk', () => {
		expect(parseRankMemory('{"posted":3,"rank":8,"previous":12}')).toEqual({
			posted: 3,
			rank: 8,
			previous: 12
		});
		expect(parseRankMemory('{"posted":3,"rank":8}')).toEqual({
			posted: 3,
			rank: 8,
			previous: null
		});
		expect(parseRankMemory('{"posted":"3","rank":8}')).toBeNull();
		expect(parseRankMemory('nope')).toBeNull();
		expect(parseRankMemory(null)).toBeNull();
	});
});

describe('lastMatch', () => {
	it('shows our latest result and how the rank moved', () => {
		const before = view(posted('q26') - 1000);
		const after = view(posted('q26'));
		expect(postedQuals(after)).toBe(postedQuals(before) + 1);
		let memory = rememberRank(null, postedQuals(before), before.ranking!.rank);
		memory = rememberRank(memory, postedQuals(after), after.ranking!.rank);
		const last = lastMatch(after, memory)!;
		expect(last).toMatchObject({
			key: 'q26',
			label: 'Q26',
			outcome: 'win',
			ours: 75,
			theirs: 64,
			partners: [25620],
			opponents: [32043, 22258],
			rank: after.ranking!.rank,
			move: before.ranking!.rank - after.ranking!.rank
		});
		expect(lastMatch(after, null)?.move).toBeNull();
		expect(lastMatch(after, { ...memory!, posted: 1 })?.move).toBeNull();
	});

	it('has nothing before our first result', () => {
		expect(lastMatch(view(full.matches[0].scheduledTime! - 60_000), null)).toBeNull();
	});
});

describe('moveText', () => {
	const last = (rank: number | null, move: number | null): LastMatch => ({
		key: 'q1',
		label: 'Q1',
		outcome: 'win',
		ours: 1,
		theirs: 0,
		partners: [],
		opponents: [],
		rank,
		move
	});

	it('says which way we moved', () => {
		expect(moveText(last(4, 3))).toBe('Up 3 places to 4th.');
		expect(moveText(last(4, -1))).toBe('Down 1 place to 4th.');
		expect(moveText(last(4, 0))).toBe('Still 4th.');
		expect(moveText(last(4, null))).toBe('Ranked 4th.');
		expect(moveText(last(null, null))).toBeNull();
	});
});
