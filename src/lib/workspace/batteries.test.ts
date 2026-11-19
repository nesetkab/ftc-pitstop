import { describe, expect, it } from 'vitest';
import {
	addBattery,
	markCharged,
	nextBatteryName,
	parseUsed,
	putInRobot,
	removeBattery,
	restedMinutes,
	restLabel,
	setNote,
	setStatus,
	setUsed,
	setVoltage,
	suggestNext
} from '#lib/workspace/batteries.ts';
import type { Batteries, Battery } from '#lib/workspace/schemas.ts';

const MIN = 60_000;
const NOW = 1_700_000_000_000;

function battery(name: string, overrides: Partial<Battery> = {}): Battery {
	return {
		id: name.toLowerCase(),
		name,
		status: 'charged',
		voltage: 13,
		used: [],
		note: '',
		restedSince: NOW - 30 * MIN,
		...overrides
	};
}

const group = (...items: Battery[]): Batteries => ({ items });

describe('use next suggestion', () => {
	it('picks the charged battery with the highest voltage', () => {
		const items = [
			battery('B1', { voltage: 12.9 }),
			battery('B2', { voltage: 13.1 }),
			battery('B3', { voltage: 13.0 })
		];
		expect(suggestNext(items)).toBe('b2');
	});

	it('prefers the one that rested longest when voltage ties', () => {
		const items = [
			battery('B1', { voltage: 13.1, restedSince: NOW - 5 * MIN }),
			battery('B2', { voltage: 13.1, restedSince: NOW - 40 * MIN }),
			battery('B3', { voltage: 13.1, restedSince: NOW - 20 * MIN })
		];
		expect(suggestNext(items)).toBe('b2');
	});

	it('treats an unknown rest time as rested the longest', () => {
		const items = [
			battery('B1', { voltage: 13.1, restedSince: NOW - 5 * MIN }),
			battery('B2', { voltage: 13.1, restedSince: null })
		];
		expect(suggestNext(items)).toBe('b2');
	});

	it('ignores batteries that are not charged', () => {
		const items = [
			battery('B1', { status: 'in-robot', voltage: 13.4 }),
			battery('B2', { status: 'charging', voltage: 13.3 }),
			battery('B3', { status: 'not-in-use', voltage: 13.2 }),
			battery('B4', { voltage: 12.7 })
		];
		expect(suggestNext(items)).toBe('b4');
	});

	it('puts batteries without a voltage last', () => {
		const items = [battery('B1', { voltage: null }), battery('B2', { voltage: 12.2 })];
		expect(suggestNext(items)).toBe('b2');
		expect(suggestNext([battery('B1', { voltage: null })])).toBe('b1');
	});

	it('suggests nothing when no battery is charged', () => {
		expect(suggestNext([])).toBeNull();
		expect(suggestNext([battery('B1', { status: 'charging' })])).toBeNull();
	});

	it('breaks full ties by name in natural order', () => {
		const items = [
			battery('B10', { restedSince: null }),
			battery('B2', { restedSince: null }),
			battery('B1', { restedSince: null })
		];
		expect(suggestNext(items)).toBe('b1');
	});
});

describe('battery actions', () => {
	it('names new batteries after the highest number', () => {
		expect(nextBatteryName([])).toBe('B1');
		expect(nextBatteryName([battery('B1'), battery('B4'), battery('Spare')])).toBe('B5');
		const added = addBattery(group(battery('B1')), 'fresh', NOW);
		expect(added.items.at(-1)).toMatchObject({
			id: 'fresh',
			name: 'B2',
			status: 'charged',
			voltage: null,
			restedSince: NOW
		});
		expect(addBattery(added, 'fresh', NOW)).toBe(added);
	});

	it('puts a battery in the robot and logs the match', () => {
		const start = group(battery('B1'), battery('B2', { used: ['Q5'] }));
		const next = putInRobot(start, 'b2', 'Q26');
		expect(next.items[1]).toMatchObject({
			status: 'in-robot',
			used: ['Q5', 'Q26'],
			restedSince: null
		});
	});

	it('moves the battery that was in the robot to the charger', () => {
		const start = group(battery('B1', { status: 'in-robot', restedSince: null }), battery('B2'));
		const next = putInRobot(start, 'b2', 'Q26');
		expect(next.items[0]).toMatchObject({ status: 'charging', restedSince: null });
		expect(next.items.filter((item) => item.status === 'in-robot')).toHaveLength(1);
	});

	it('does not log the same match twice in a row or an empty match', () => {
		const start = group(battery('B1', { used: ['Q26'] }));
		expect(putInRobot(start, 'b1', 'Q26').items[0].used).toEqual(['Q26']);
		expect(putInRobot(start, 'b1', '  ').items[0].used).toEqual(['Q26']);
	});

	it('ignores an unknown battery', () => {
		const start = group(battery('B1'));
		expect(putInRobot(start, 'zzz', 'Q1')).toBe(start);
	});

	it('marks a battery charged and starts its rest', () => {
		const start = group(battery('B1', { status: 'charging', restedSince: null }));
		expect(markCharged(start, 'b1', NOW).items[0]).toMatchObject({
			status: 'charged',
			restedSince: NOW
		});
	});

	it('keeps rest time only where it means something', () => {
		const start = group(battery('B1'));
		expect(setStatus(start, 'b1', 'charging', NOW).items[0].restedSince).toBeNull();
		expect(setStatus(start, 'b1', 'not-in-use', NOW).items[0].restedSince).toBe(
			start.items[0].restedSince
		);
		const charging = group(battery('B1', { status: 'charging', restedSince: null }));
		expect(setStatus(charging, 'b1', 'charged', NOW).items[0].restedSince).toBe(NOW);
		expect(setStatus(start, 'b1', 'charged', NOW)).toEqual(start);
	});

	it('edits voltage, note and used matches', () => {
		let next = group(battery('B1'));
		next = setVoltage(next, 'b1', 13.456);
		expect(next.items[0].voltage).toBe(13.46);
		expect(setVoltage(next, 'b1', 99).items[0].voltage).toBe(30);
		expect(setVoltage(next, 'b1', -3).items[0].voltage).toBe(0);
		expect(setVoltage(next, 'b1', null).items[0].voltage).toBeNull();
		expect(setVoltage(next, 'b1', Number.NaN).items[0].voltage).toBeNull();
		next = setNote(next, 'b1', 'Dropped low in Q5');
		next = setUsed(next, 'b1', ['Q5', 'Q14']);
		expect(next.items[0]).toMatchObject({ note: 'Dropped low in Q5', used: ['Q5', 'Q14'] });
	});

	it('removes a battery', () => {
		expect(
			removeBattery(group(battery('B1'), battery('B2')), 'b1').items.map((b) => b.name)
		).toEqual(['B2']);
	});

	it('parses a list of matches typed by hand', () => {
		expect(parseUsed('Q5, Q14  Q17;Q5')).toEqual(['Q5', 'Q14', 'Q17']);
		expect(parseUsed('')).toEqual([]);
		expect(parseUsed(' , ')).toEqual([]);
	});
});

describe('rest time', () => {
	it('counts minutes for charged batteries only', () => {
		expect(restedMinutes(battery('B1', { restedSince: NOW - 90 * MIN }), NOW)).toBe(90);
		expect(restedMinutes(battery('B1', { restedSince: NOW + MIN }), NOW)).toBe(0);
		expect(restedMinutes(battery('B1', { status: 'charging' }), NOW)).toBeNull();
		expect(restedMinutes(battery('B1', { restedSince: null }), NOW)).toBeNull();
	});

	it('describes it in plain words', () => {
		expect(restLabel(null)).toBe('');
		expect(restLabel(0)).toBe('Just charged');
		expect(restLabel(24)).toBe('Rested 24 min');
		expect(restLabel(60)).toBe('Rested 1 h');
		expect(restLabel(65)).toBe('Rested 1 h 5 min');
	});
});
