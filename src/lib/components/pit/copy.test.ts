import { describe, expect, it } from 'vitest';
import { replayBundle } from '#lib/game/replay.ts';
import {
	awardName,
	fieldLine,
	nextMatchLabel,
	queueCountdown,
	resultLine,
	teamsLine,
	updatedClock
} from './copy.ts';
import { fixtureBundle } from './fixtures.ts';
import type { QueueCall } from './queue.ts';
import { pitView } from './view.ts';

const TEAM = 14624;
const full = fixtureBundle('USAZGIQ');
const match = (key: string) => full.matches.find((item) => item.key === key)!;
const view = (time: number) =>
	pitView({ bundle: replayBundle(full, time), analysis: null, queue: null, team: TEAM });

describe('fieldLine', () => {
	it('says what is on the field and how many matches until ours', () => {
		expect(fieldLine(view(match('q23').actualTime!))).toBe(
			'Q23 is on the field. 2 matches until ours.'
		);
		expect(fieldLine(view(match('q24').actualTime!))).toBe(
			'Q24 is on the field. One match until ours.'
		);
		expect(fieldLine(view(match('q25').actualTime!))).toBe("Q25 is on the field. We're up next.");
	});

	it('stays quiet when our match is on the field or nothing is', () => {
		expect(fieldLine(view(match('q26').actualTime!))).toBeNull();
		expect(fieldLine(view(full.matches[0].scheduledTime! - 3_600_000))).toBeNull();
	});
});

describe('queueCountdown', () => {
	const next = view(match('q23').actualTime!).next!;
	const now = Date.parse('2026-11-14T20:00:00Z');

	it('counts down to the queue time until we are called', () => {
		expect(queueCountdown({ ...next, queueAt: now + 25 * 60_000 }, null, now)).toBe(
			'in 25 minutes'
		);
		expect(queueCountdown({ ...next, queueAt: now - 60_000 }, null, now)).toBeNull();
		expect(queueCountdown({ ...next, queueAt: null }, null, now)).toBeNull();
		const call: QueueCall = {
			key: next.key,
			label: next.label,
			alliance: next.alliance,
			reason: 'timing'
		};
		expect(queueCountdown({ ...next, queueAt: now + 60_000 }, call, now)).toBeNull();
	});
});

describe('result copy', () => {
	it('reads like a scoreboard', () => {
		expect(resultLine('win', 75, 64)).toBe('Won 75–64');
		expect(resultLine('tie', 50, 50)).toBe('Tied 50–50');
		expect(teamsLine([25620], [32043, 22258])).toBe('With 25620 against 32043, 22258.');
		expect(teamsLine([], [32043])).toBe('Against 32043.');
		expect(teamsLine([], [])).toBe('');
	});
});

describe('updatedClock', () => {
	it('names the day when the data is from an earlier day', () => {
		const zone = 'America/Denver';
		const posted = Date.parse('2026-11-21T18:36:39Z');
		expect(updatedClock(posted, posted + 60_000, zone)).toMatch(/^11:36:39\sAM$/);
		expect(updatedClock(posted, Date.parse('2026-11-22T11:21:00Z'), zone)).toMatch(
			/^Sat 11:36\sAM$/
		);
	});
});

describe('awardName', () => {
	it('drops the sponsor so award names fit a pit screen row', () => {
		expect(awardName('Innovate Award sponsored by RTX')).toBe('Innovate Award');
		expect(awardName('Innovate Award sponsored by RTX 2nd place')).toBe('Innovate Award 2nd place');
		expect(awardName('Winning Alliance - Captain')).toBe('Winning alliance captain');
		expect(awardName('Control Award')).toBe('Control Award');
	});
});

describe('nextMatchLabel', () => {
	it('names the playoff round in plain words', () => {
		expect(nextMatchLabel(null)).toBe('Next match');
		expect(nextMatchLabel('Upper bracket round 2')).toBe('Next match in upper bracket round 2');
		expect(nextMatchLabel('Finals')).toBe('Next match in the finals');
		expect(nextMatchLabel('Semifinal 1')).toBe('Next match, Semifinal 1');
	});
});
