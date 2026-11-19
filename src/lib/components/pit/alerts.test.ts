import { describe, expect, it } from 'vitest';
import { replayBundle, replayStart, selectionWindow } from '#lib/game/replay.ts';
import {
	DEFAULT_ALERTS,
	alertSnapshot,
	alertsBetween,
	parseAlertSettings,
	type AlertSettings
} from './alerts.ts';
import { fixtureBundle } from './fixtures.ts';
import { pitView } from './view.ts';

const ZONE = 'America/Phoenix';
const full = fixtureBundle('USAZGIQ');
const at = (label: string) => replayStart(label, full)!;
const snapshot = (time: number) =>
	alertSnapshot(
		pitView({ bundle: replayBundle(full, time), analysis: null, queue: null, team: 14624 })
	);
const all: AlertSettings = {
	twoBefore: true,
	scorePosted: true,
	rankChanges: true,
	selectionStarts: true
};
const match = (key: string) => full.matches.find((item) => item.key === key)!;

describe('alertsBetween', () => {
	it('says nothing on the first look', () => {
		expect(alertsBetween(null, snapshot(at('Q22')), all, ZONE)).toEqual([]);
	});

	it('warns two matches before ours', () => {
		const alerts = alertsBetween(
			snapshot(at('Q22')),
			snapshot(match('q23').actualTime!),
			all,
			ZONE
		);
		expect(alerts).toContainEqual({
			id: 'away:q26',
			title: 'Q26 is two matches away',
			body: 'Red alliance with 25620.'
		});
		const again = alertsBetween(
			snapshot(match('q23').actualTime!),
			snapshot(match('q24').actualTime!),
			all,
			ZONE
		);
		expect(again.some((alert) => alert.id === 'away:q26')).toBe(false);
	});

	it('posts our score and rank changes', () => {
		const before = snapshot(match('q26').postedTime! - 1000);
		const after = snapshot(match('q26').postedTime!);
		const alerts = alertsBetween(before, after, all, ZONE);
		expect(alerts).toContainEqual({
			id: 'score:q26',
			title: 'Q26: won 75–64',
			body: 'With 25620.'
		});
		const rank = alerts.find((alert) => alert.id.startsWith('rank:'));
		expect(rank?.title).toMatch(/^Now ranked \d+(st|nd|rd|th)$/);
		expect(rank?.body).toMatch(/^(Up|Down) from \d+(st|nd|rd|th)\.$/);
	});

	it('announces alliance selection', () => {
		const lastQual = match('q34').postedTime!;
		const alerts = alertsBetween(snapshot(lastQual - 1000), snapshot(lastQual), all, ZONE);
		expect(alerts).toContainEqual({
			id: 'selection',
			title: 'Alliance selection is starting',
			body: 'We finished 6th.'
		});
		const window = selectionWindow(full)!;
		expect(
			alertsBetween(snapshot(window.start), snapshot(window.end), all, ZONE).map((a) => a.id)
		).not.toContain('selection');
	});

	it('respects the settings', () => {
		const before = snapshot(match('q26').postedTime! - 1000);
		const after = snapshot(match('q26').postedTime!);
		const none = {
			twoBefore: false,
			scorePosted: false,
			rankChanges: false,
			selectionStarts: false
		};
		expect(alertsBetween(before, after, none, ZONE)).toEqual([]);
		const defaults = alertsBetween(before, after, DEFAULT_ALERTS, ZONE).map((alert) => alert.id);
		expect(defaults).toContain('score:q26');
		expect(defaults.some((id) => id.startsWith('rank:'))).toBe(false);
	});
});

describe('parseAlertSettings', () => {
	it('reads saved settings and ignores junk', () => {
		expect(parseAlertSettings(null)).toEqual(DEFAULT_ALERTS);
		expect(parseAlertSettings('not json')).toEqual(DEFAULT_ALERTS);
		expect(parseAlertSettings('{"rankChanges":true,"twoBefore":"yes"}')).toEqual({
			...DEFAULT_ALERTS,
			rankChanges: true
		});
	});
});
