import { describe, expect, it } from 'vitest';
import { ordinal } from '#lib/format/ordinal.ts';
import { replayBundle, replayStart, selectionWindow } from '#lib/game/replay.ts';
import {
	DEFAULT_ALERTS,
	alertPreview,
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
		expect(alertsBetween(null, snapshot(at('Q22')), all, ZONE, at('Q22'))).toEqual([]);
	});

	it('warns two matches before ours', () => {
		const alerts = alertsBetween(
			snapshot(at('Q22')),
			snapshot(match('q23').actualTime!),
			all,
			ZONE,
			match('q23').actualTime!
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
			ZONE,
			match('q24').actualTime!
		);
		expect(again.some((alert) => alert.id === 'away:q26')).toBe(false);
	});

	it('posts our score and rank changes', () => {
		const before = snapshot(match('q26').postedTime! - 1000);
		const after = snapshot(match('q26').postedTime!);
		const alerts = alertsBetween(before, after, all, ZONE, match('q26').postedTime!);
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
		const alerts = alertsBetween(
			snapshot(lastQual - 1000),
			snapshot(lastQual),
			all,
			ZONE,
			lastQual
		);
		expect(alerts).toContainEqual({
			id: 'selection',
			title: 'Alliance selection is starting',
			body: 'We finished 6th.'
		});
		const window = selectionWindow(full)!;
		expect(
			alertsBetween(snapshot(window.start), snapshot(window.end), all, ZONE, window.end).map(
				(a) => a.id
			)
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
		const now = match('q26').postedTime!;
		expect(alertsBetween(before, after, none, ZONE, now)).toEqual([]);
		const defaults = alertsBetween(before, after, DEFAULT_ALERTS, ZONE, now).map(
			(alert) => alert.id
		);
		expect(defaults).toContain('score:q26');
		expect(defaults.some((id) => id.startsWith('rank:'))).toBe(false);
	});

	it('names the day when the queue time is not today', () => {
		const after = snapshot(match('q23').actualTime!);
		const queueAt = Date.parse('2026-11-15T02:47:00Z');
		const later = { ...after, next: { ...after.next!, queueAt } };
		const alert = (now: number) =>
			alertsBetween({ ...after, next: null }, later, all, ZONE, now).find((item) =>
				item.id.startsWith('away:')
			)?.body;
		expect(alert(Date.parse('2026-11-14T06:00:00Z'))).toBe(
			'Red alliance with 25620. Queue at Sat 7:47\u00a0PM.'
		);
		expect(alert(Date.parse('2026-11-14T20:00:00Z'))).toBe(
			'Red alliance with 25620. Queue at 7:47\u00a0PM.'
		);
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

describe('alertPreview', () => {
	const view = (time: number) =>
		pitView({ bundle: replayBundle(full, time), analysis: null, queue: null, team: 14624 });

	it('previews each alert with our real next match and last score', () => {
		const now = match('q26').postedTime!;
		const current = view(now);
		expect(alertPreview(current, 'twoBefore', ZONE, now)?.title).toMatch(
			/^Q\d+ is (next|one match away|two matches away)$/
		);
		expect(alertPreview(current, 'scorePosted', ZONE, now)).toEqual({
			id: 'score:q26',
			title: 'Q26: won 75–64',
			body: 'With 25620.'
		});
		const rank = current.ranking!.rank;
		expect(alertPreview(current, 'rankChanges', ZONE, now)?.title).toBe(
			`Now ranked ${ordinal(rank)}`
		);
		expect(alertPreview(current, 'selectionStarts', ZONE, now)?.title).toBe(
			'Alliance selection is starting'
		);
	});

	it('has nothing to preview before the data exists', () => {
		const now = full.matches[0].scheduledTime! - 3_600_000;
		const early = view(now);
		expect(alertPreview(early, 'scorePosted', ZONE, now)).toBeNull();
		expect(alertPreview(early, 'rankChanges', ZONE, now)).toBeNull();
		expect(alertPreview(early, 'selectionStarts', ZONE, now)?.body).toBe(
			'Qualification matches are done.'
		);
	});
});
