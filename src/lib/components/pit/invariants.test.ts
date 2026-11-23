import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { retime } from '#lib/analysis/analyze.ts';
import type { EventAnalysis } from '#lib/analysis/types.ts';
import { dayTime, sameDay } from '#lib/format/time.ts';
import { replayBundle, revealTime } from '#lib/game/replay.ts';
import type { EventBundle, Ranking } from '#lib/types.ts';
import { DEFAULT_ALERTS, alertSnapshot, alertsBetween } from './alerts.ts';
import {
	heroText,
	matchItems,
	phoneDetail,
	plannedTime,
	playoffResult,
	qualsDoneText
} from './copy.ts';
import { fixtureBundle } from './fixtures.ts';
import { queueCall } from './queue.ts';
import { sideOf } from '#lib/components/event/matches.ts';
import { isGap, pitView, rankWindow, ROW_FIT, rowCapacity } from './view.ts';

const MINUTE = 60_000;
const EVENTS = readdirSync(join(process.cwd(), 'tests/fixtures/ftc/2026/'));
const WEEKDAY = /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d/;

function teamsFor(bundle: EventBundle): number[] {
	const ranked = bundle.rankings.map((row) => row.team);
	const playing = [...new Set(bundle.matches.flatMap((m) => [...m.red, ...m.blue]))].map(
		(slot) => slot.team
	);
	const pool = ranked.length > 0 ? ranked.filter((team) => playing.includes(team)) : playing;
	const captain = bundle.alliances.at(-1)?.captain;
	const picks = [pool[0], pool[Math.floor(pool.length / 2)], pool.at(-1), captain];
	return [...new Set(picks.filter((team): team is number => team !== undefined))];
}

function steps(bundle: EventBundle): number[] {
	const times = bundle.matches.flatMap((match) =>
		[match.scheduledTime, revealTime(match)].filter((time): time is number => time !== null)
	);
	if (times.length === 0) return [];
	const start = Math.min(...times) - 30 * MINUTE;
	const end = Math.max(...times) + 30 * MINUTE;
	const step = Math.max(5 * MINUTE, (end - start) / 250);
	const list: number[] = [];
	for (let time = start; time <= end; time += step) list.push(time);
	for (const time of times) list.push(time - 1000, time + 1000);
	return list.sort((a, b) => a - b);
}

function check(full: EventBundle, team: number, now: number): string[] {
	const bundle = replayBundle(full, now);
	const zone = full.event.timezone;
	const analysis = retime({ forecasts: {}, ratings: [] } as unknown as EventAnalysis, bundle, now);
	const view = pitView({ bundle, analysis, queue: null, team });
	const problems: string[] = [];
	const say = (text: string) => problems.push(text);
	const next = view.next;
	const call = queueCall(next, now);
	const posted = bundle.matches.filter((m) => m.result && sideOf(m, team) !== null);
	if (posted.length === 0 && view.ranking) say(`rank ${view.ranking.rank} before any match`);
	if (view.ranking && view.ranking.rank > view.teamCount) say('rank beyond team count');
	if (next) {
		const truth = full.matches.find((m) => m.key === next.key);
		const reveal = truth?.result ? revealTime(truth) : null;
		if (reveal !== null && reveal <= now) say(`next ${next.label} already posted`);
		if (next.matchesAway < 0) say('negative matches away');
		const hero = heroText(next, call, now, zone, view.delaySeconds);
		const text = [hero.headline, ...hero.detail].join(' ');
		if (/NaN|undefined|null/.test(text)) say(`broken hero: ${text}`);
		const minutes = text.match(/running (\d+) minutes?/);
		if (minutes && Number(minutes[1]) > 240) say(`absurd delay: ${text}`);
		const shownTimes = [
			hero.headline.startsWith('Queue at') ? next.queueAt : null,
			hero.headline.startsWith('Scheduled') ? next.scheduled : null,
			text.includes('around') ? next.expectedStart : null
		];
		for (const value of shownTimes) {
			if (value === null || sameDay(value, now, zone)) continue;
			if (!WEEKDAY.test(text)) say(`hero time on another day: ${text}`);
		}
		const after = alertSnapshot(view);
		for (const alert of alertsBetween({ ...after, next: null }, after, DEFAULT_ALERTS, zone, now)) {
			const body = `${alert.title} ${alert.body}`;
			if (/NaN|undefined|null/.test(body)) say(`broken alert: ${body}`);
			if (next.queueAt === null || sameDay(next.queueAt, now, zone)) continue;
			if (!WEEKDAY.test(alert.body)) say(`alert time on another day: ${body}`);
		}
		const listed = matchItems(view.matches, next.key, zone, now).find(
			(item) => item.label === next.label
		);
		if (next.started === null && listed) {
			const field = next.expectedStart ?? next.scheduled;
			const clock = field === null ? '' : dayTime(field, now, zone);
			const want = next.expectedStart === null ? clock : `~${clock}`;
			if (listed.status !== want) say(`list ${listed.status} but hero time ${want}`);
			const phone = phoneDetail(next, zone, view.delaySeconds, now);
			if (next.expectedStart !== null && !text.includes(clock)) {
				say(`hero ${text} misses list time ${want}`);
			}
			if (next.expectedStart !== null && !phone.includes(clock)) {
				say(`phone ${phone} misses list time ${want}`);
			}
		}
		if (view.phase === 'done') say(`next match ${next.label} after the event`);
		if (call && next.expectedStart !== null && next.expectedStart - now > 45 * MINUTE) {
			say(`queue call long before the match: ${text}`);
		}
		if (view.playoff?.state === 'eliminated' && next.level === 'playoff') {
			say('eliminated team has a playoff match');
		}
	} else {
		const unplayed = bundle.matches.filter(
			(m) => sideOf(m, team) !== null && m.result === null && m.level === 'qual'
		);
		if (view.phase === 'quals' && unplayed.length > 0) say('quals left but no next match');
		if (view.phase === 'quals' && qualsDoneText(view).headline.includes('done')) {
			if (unplayed.length > 0) say('quals called done too early');
		}
		if (view.phase === 'playoffs' && view.playoff?.state === 'alive') {
			say(`alive in playoffs without a next match (${playoffResult(view) ?? 'waiting'})`);
		}
	}
	if (view.playoff?.state === 'won' && view.phase !== 'done') say('won before the event ended');
	for (const item of matchItems(view.matches, next?.key ?? null, zone, now)) {
		if (item.state === 'done' || item.status === 'On field' || item.status === '') continue;
		const match = view.matches.find((m) => m.label === item.label)!;
		const planned = plannedTime(match)!;
		if (planned.estimate && planned.at < now - 15 * MINUTE) {
			say(`${item.label} estimate ${item.status} is already past`);
		}
		if (!sameDay(planned.at, now, zone) && !WEEKDAY.test(item.status ?? '')) {
			say(`${item.label} lists ${item.status} from another day`);
		}
	}
	return problems.map(
		(text) => `${full.event.code} ${team} ${new Date(now).toISOString()} ${text}`
	);
}

describe('pit flow invariants across every fixture', () => {
	it.each(EVENTS)('%s replays cleanly', (code) => {
		const full = fixtureBundle(code);
		const problems = new Set<string>();
		for (const team of teamsFor(full)) {
			for (const now of steps(full)) {
				for (const problem of check(full, team, now)) problems.add(problem);
			}
		}
		expect([...problems].slice(0, 20)).toEqual([]);
	});
});

describe('rankings always fit the screen', () => {
	it.each(EVENTS)('%s keeps every window honest', (code) => {
		const { rankings } = fixtureBundle(code);
		const problems = new Set<string>();
		for (const { team } of rankings) {
			for (let size = 1; size <= rankings.length + 2; size++) {
				const rows = rankWindow(rankings, team, size);
				const say = (text: string) => problems.add(`${code} ${team} size ${size}: ${text}`);
				const shown = rows.filter((row): row is Ranking => !isGap(row));
				const hidden = rows.reduce((sum, row) => sum + (isGap(row) ? row.hidden : 0), 0);
				if (rows.length > size) say(`${rows.length} rows`);
				if (size >= 4 && shown.length + hidden !== rankings.length) say('rows lost');
				if (!shown.some((row) => row.team === team)) say('our team missing');
				if (rows.some((row) => isGap(row) && row.hidden < 1)) say('empty gap');
				if (rows.some((row, index) => isGap(row) && index > 0 && isGap(rows[index - 1]))) {
					say('gaps touch');
				}
				if (size >= 4 && shown[0].rank !== rankings[0].rank) say('leader missing');
				if (size >= rankings.length && rows.length !== rankings.length)
					say('cut a table that fits');
				const index = rankings.findIndex((row) => row.team === team);
				if (size >= 6 && index > 0 && !shown.includes(rankings[index - 1])) {
					say('no team just above ours');
				}
				const ranks = shown.map((row) => rankings.indexOf(row));
				if (ranks.some((rank, index) => index > 0 && rank <= ranks[index - 1])) say('out of order');
			}
		}
		expect([...problems].slice(0, 20)).toEqual([]);
	});

	it('turns the measured height into rows at the smallest readable size', () => {
		const pitch = 24 * ROW_FIT.min * ROW_FIT.row;
		expect(rowCapacity(0, 24)).toBeNull();
		expect(rowCapacity(800, 0)).toBeNull();
		expect(rowCapacity(800, Number.NaN)).toBeNull();
		expect(rowCapacity(pitch * 28, 24)).toBe(27);
		expect(rowCapacity(pitch * 28 - 1, 24)).toBe(26);
		expect(rowCapacity(pitch, 24)).toBe(1);
	});
});
