import { describe, expect, it } from 'vitest';
import type { EventAnalysis } from '#lib/analysis/types.ts';
import { replayBundle, replayStart, selectionWindow } from '#lib/game/replay.ts';
import { heroText, matchItems, playoffResult } from './copy.ts';
import { fixtureBundle } from './fixtures.ts';
import { queueCall } from './queue.ts';
import { bundleSignature, pitView, rankWindow } from './view.ts';

const TEAM = 14624;
const ZONE = 'America/Phoenix';
const full = fixtureBundle('USAZGIQ');
const at = (label: string) => replayStart(label, full)!;
const nb = (text: string) => text.replace(/ (?=[AP]M)/g, '\u00a0');
const view = (time: number, analysis: EventAnalysis | null = null) =>
	pitView({ bundle: replayBundle(full, time), analysis, queue: null, team: TEAM });

describe('pitView during quals', () => {
	const current = view(at('Q22'));

	it('finds the next match and how far away it is', () => {
		expect(current.phase).toBe('quals');
		expect(current.next).toMatchObject({
			key: 'q26',
			alliance: 'red',
			partners: [25620],
			opponents: [32043, 22258],
			matchesAway: 3,
			queueAt: null,
			expectedStart: null,
			forecast: null
		});
		expect(current.next?.red.map((slot) => [slot.number, slot.rank, slot.me])).toEqual([
			[25620, 20, false],
			[TEAM, 8, true]
		]);
		expect(current.upNext).toBe('Q23');
		expect(current.onField).toBeNull();
		expect(current.delaySeconds).toBe(142);
	});

	it('summarizes our matches and the last result', () => {
		expect(current.ranking).toMatchObject({ rank: 8, wins: 3, losses: 0 });
		expect(current.rankedAfter).toBe('Q22');
		expect(current.teamCount).toBe(27);
		expect(current.lastResult).toEqual({
			label: 'Q22',
			winner: 'blue',
			teams: [26670, 18421],
			high: 97,
			low: 45
		});
		expect(matchItems(current.matches, current.next?.key ?? null, ZONE)).toEqual([
			{
				label: 'Q5',
				status: 'Won',
				detail: 'with 15058',
				value: '36–26',
				state: 'done',
				href: undefined
			},
			{
				label: 'Q14',
				status: 'Won',
				detail: 'with 18421',
				value: '74–26',
				state: 'done',
				href: undefined
			},
			{
				label: 'Q17',
				status: 'Won',
				detail: 'with 2844',
				value: '61–22',
				state: 'done',
				href: undefined
			},
			{
				label: 'Q26',
				status: nb('1:58 PM'),
				detail: 'Red, with 25620',
				value: '',
				state: 'next',
				href: undefined
			},
			{
				label: 'Q31',
				status: nb('2:31 PM'),
				detail: 'Blue, with 26128',
				value: '',
				state: 'upcoming',
				href: undefined
			}
		]);
	});

	it('writes the hero from the schedule when there is no model', () => {
		const next = current.next!;
		expect(heroText(next, null, at('Q22'), ZONE, current.delaySeconds)).toEqual({
			headline: nb('Scheduled for 1:58 PM'),
			detail: ['3 matches from now.', 'The field is running 2 minutes behind.'],
			urgent: false
		});
	});

	it('uses the model when it is there', () => {
		const queueAt = Date.parse('2026-11-14T20:46:00Z');
		const expectedStart = Date.parse('2026-11-14T21:01:00Z');
		const analysis = {
			ratings: [{ team: TEAM, opr: 20.4, rank: 11 }],
			forecasts: {
				q26: {
					key: 'q26',
					red: {
						score: 58,
						sd: 10,
						win: 0.51,
						rp: { swarm: 0.23, pollinator1: 0.13, pollinator2: 0 }
					},
					blue: {
						score: 57,
						sd: 10,
						win: 0.49,
						rp: { swarm: 0.2, pollinator1: 0.1, pollinator2: 0 }
					},
					tie: 0,
					played: false,
					correct: null
				}
			},
			timing: {
				cycleSeconds: 390,
				delaySeconds: 120,
				onField: 'q23',
				next: 'q24',
				matches: { q26: { key: 'q26', scheduled: 0, expectedStart, queueAt, matchesAway: 3 } }
			},
			projections: [{ team: TEAM, top8: 0.59 }],
			playoffs: null,
			picks: null
		} as unknown as EventAnalysis;
		const modeled = view(Date.parse('2026-11-14T20:41:00Z'), analysis);
		expect(modeled.next).toMatchObject({ queueAt, expectedStart, win: 0.51 });
		expect(modeled.opr).toBe(20.4);
		expect(modeled.top8).toBe(0.59);
		expect(modeled.onField).toBe('Q23');
		expect(heroText(modeled.next!, null, Date.parse('2026-11-14T20:41:00Z'), ZONE, 120)).toEqual({
			headline: nb('Queue at 1:46 PM'),
			detail: [
				'In 5 minutes.',
				nb('On the field around 2:01 PM, 3 matches from now.'),
				'The field is running 2 minutes behind.'
			],
			urgent: false
		});
		const call = queueCall(modeled.next, queueAt);
		expect(heroText(modeled.next!, call, queueAt, ZONE, 120).headline).toBe('Queue now');
	});

	it('does not ask us to queue across a break', () => {
		const expectedStart = Date.parse('2026-11-14T21:01:00Z');
		const analysis = {
			ratings: [],
			forecasts: {},
			timing: {
				cycleSeconds: 390,
				delaySeconds: 0,
				onField: null,
				next: 'q23',
				matches: {
					q26: {
						key: 'q26',
						scheduled: expectedStart,
						expectedStart,
						queueAt: expectedStart - 50 * 60_000,
						matchesAway: 0
					}
				}
			},
			projections: null,
			playoffs: null,
			picks: null
		} as unknown as EventAnalysis;
		const next = view(at('Q22'), analysis).next!;
		expect(next.queueAt).toBe(expectedStart - 20 * 60_000);
		expect(queueCall(next, expectedStart - 40 * 60_000)).toBeNull();
		expect(queueCall(next, expectedStart - 15 * 60_000)?.reason).toBe('timing');
	});

	it('does not show a rank before our first match is posted', () => {
		const early = view(at('Q1'));
		expect(early.rankings.find((row) => row.team === TEAM)?.played).toBe(0);
		expect(early.ranking).toBeNull();
		expect(view(at('Q5')).ranking).toMatchObject({ played: 1 });
	});

	it('shows the match on the field once it starts', () => {
		const playing = view(Date.parse('2026-11-14T20:59:00Z'));
		expect(playing.next?.key).toBe('q26');
		expect(playing.next?.started).not.toBeNull();
		expect(playing.onField).toBe('Q26');
	});
});

describe('pitView after quals', () => {
	it('follows alliance selection', () => {
		const window = selectionWindow(full)!;
		const before = view(window.start - 1000);
		expect(before).toMatchObject({ phase: 'selection', role: null, alliances: [], picking: null });
		expect(before.next).toBeNull();
		const during = view(window.start + (window.end - window.start) * 0.5);
		expect(during.alliances.map((alliance) => alliance.seed)).toEqual([1, 2, 3, 4]);
		expect(during.picking).toBe(4);
		expect(during.available[0].number).not.toBe(26670);
		const after = view(window.end - 1);
		expect(after.role).toBe('captain');
		expect(after.alliance?.seed).toBe(5);
	});

	it('tracks the playoff bracket', () => {
		const first = view(at('M1'));
		expect(first.phase).toBe('playoffs');
		expect(first.playoff).toMatchObject({ state: 'alive', wins: 1, losses: 0 });
		expect(first.playoff?.position).toBe('Upper bracket round 2');
		expect(first.next?.key).toBe('p3');
		const out = view(at('M5'));
		expect(out.playoff).toMatchObject({
			state: 'eliminated',
			wins: 1,
			losses: 2,
			position: 'Out after M5'
		});
		expect(out.standings.find((standing) => standing.seed === 5)).toMatchObject({ out: true });
	});

	it('stops showing the chance to win once we are out', () => {
		const analysis = {
			ratings: [],
			forecasts: {},
			timing: { cycleSeconds: null, delaySeconds: null, onField: null, next: null, matches: {} },
			projections: null,
			playoffs: [{ seed: 5, teams: [TEAM, 2844], strength: 0, winEvent: 0.004 }],
			picks: null
		} as unknown as EventAnalysis;
		expect(view(at('M1'), analysis).playoff?.winEvent).toBe(0.004);
		expect(view(at('M5'), analysis).playoff?.winEvent).toBeNull();
	});

	it('calls the losing finalist a finalist before awards are posted', () => {
		const final = replayBundle(full, at('M10'));
		expect(final.awards).toEqual([]);
		const runnerUp = pitView({ bundle: final, analysis: null, queue: null, team: 26670 });
		expect(runnerUp.playoff).toMatchObject({ state: 'eliminated', finalist: true });
		expect(playoffResult(runnerUp)).toBe('Finalist');
		const winner = pitView({ bundle: final, analysis: null, queue: null, team: 25620 });
		expect(playoffResult(winner)).toBe('Won the event');
		expect(view(at('M10')).playoff?.finalist).toBe(false);
	});

	it('ends with the final standings and awards', () => {
		const done = view(at('M10') + 20 * 60_000);
		expect(done.phase).toBe('done');
		expect(done.ranking?.rank).toBe(6);
		expect(done.standings.find((standing) => standing.won)?.seed).toBe(2);
		expect(done.eventAwards.length).toBeGreaterThan(10);
		expect(done.advancesTo).toBe('USAZCMP');
	});

	it('knows when a team is not at the event', () => {
		expect(pitView({ bundle: full, analysis: null, queue: null, team: 99999 }).registered).toBe(
			false
		);
	});
});

describe('rankWindow', () => {
	const rows = full.rankings;

	it('keeps short tables whole and trims long ones around us', () => {
		expect(rankWindow(rows, TEAM, 30)).toHaveLength(27);
		expect(rankWindow(rows, 15058, 10).map((row) => row?.team)).toEqual(
			rows.slice(0, 10).map((row) => row.team)
		);
		const trimmed = rankWindow(rows, rows[25].team, 12);
		expect(trimmed).toHaveLength(12);
		expect(trimmed[8]).toBeNull();
		expect(trimmed.slice(9).map((row) => row?.rank)).toEqual([25, 26, 27]);
	});

	it('changes signature only when the data does', () => {
		const a = replayBundle(full, at('Q22'));
		const b = replayBundle(full, at('Q22') + 30_000);
		expect(bundleSignature(a)).toBe(bundleSignature(b));
		expect(bundleSignature(replayBundle(full, at('Q23')))).not.toBe(bundleSignature(a));
	});
});
