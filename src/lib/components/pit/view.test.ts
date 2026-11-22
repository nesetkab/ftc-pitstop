import { describe, expect, it } from 'vitest';
import { retime } from '#lib/analysis/analyze.ts';
import type { EventAnalysis } from '#lib/analysis/types.ts';
import { replayBundle, replayStart, selectionWindow } from '#lib/game/replay.ts';
import { time } from '#lib/format/time.ts';
import {
	absentText,
	delayText,
	heroText,
	liveText,
	matchItems,
	playoffResult,
	shortDelay
} from './copy.ts';
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
		expect(matchItems(current.matches, current.next?.key ?? null, ZONE, at('Q22'))).toEqual([
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
		expect(liveText(modeled, call)).toMatch(/Next match Q26, Red alliance\. Queue now\.$/);
	});

	it('announces only results and the next match, not every clock tick', () => {
		const early = view(at('Q23'));
		const later = view(at('Q25'));
		expect(heroText(early.next!, null, at('Q23'), ZONE, early.delaySeconds)).not.toEqual(
			heroText(later.next!, null, at('Q25'), ZONE, later.delaySeconds)
		);
		expect(liveText(early, null)).toBe(liveText(later, null));
		expect(liveText(early, null)).toMatch(
			/^Q\d+ (won|lost|tied) \d+–\d+\. Next match Q26, Red alliance\.$/
		);
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

	it('skips an earlier match that is held or never scored', () => {
		const time = at('Q22');
		const bundle = replayBundle(full, time);
		const held = {
			...bundle,
			matches: bundle.matches.map((match) =>
				match.key === 'q14' ? { ...match, actualTime: null, postedTime: null, result: null } : match
			)
		};
		const current = pitView({ bundle: held, analysis: null, queue: null, team: TEAM });
		expect(current.next).toMatchObject({ key: 'q26', matchesAway: 3 });
		expect(current.upNext).toBe('Q23');
		expect(queueCall(current.next, time)).toBeNull();
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

describe('matches carried over to the next day', () => {
	const astana = fixtureBundle('KZASQ1');
	const now = replayStart('Q30', astana)!;
	const bundle = replayBundle(astana, now);
	const zone = astana.event.timezone;
	const items = (analysis: EventAnalysis | null) => {
		const current = pitView({ bundle, analysis, queue: null, team: 36465 });
		return matchItems(current.matches, current.next?.key ?? null, zone, now);
	};

	it('lists the estimate the headline uses instead of the stale schedule', () => {
		const analysis = retime(
			{ forecasts: {}, ratings: [] } as unknown as EventAnalysis,
			bundle,
			now
		);
		const q36 = items(analysis).find((item) => item.label === 'Q36')!;
		const expected = analysis.timing.matches.q36.expectedStart!;
		expect(q36.status).toBe(`~${time(expected, zone)}`);
		expect(q36.status).not.toContain('7:47');
	});

	it('names the day when it falls back to an old scheduled time', () => {
		const q36 = items(null).find((item) => item.label === 'Q36')!;
		expect(q36.status).toBe(nb('Sat 7:47 PM'));
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

	it('shows the next playoff match before the opponent is known', () => {
		const captain = pitView({
			bundle: replayBundle(full, at('M3')),
			analysis: null,
			queue: null,
			team: 26670
		});
		expect(captain.next).toMatchObject({
			key: 'p7',
			alliance: 'red',
			opponents: [],
			blue: [],
			pending: 'Winner of M4'
		});
		expect(captain.playoff?.position).toBe('Upper bracket round 4');
		const lower = pitView({
			bundle: replayBundle(full, at('M7')),
			analysis: null,
			queue: null,
			team: 26670
		});
		expect(lower.next).toMatchObject({ key: 'p9', pending: 'Winner of M8' });
		expect(lower.playoff?.position).toBe('Lower bracket round 5');
	});

	it('plays the tiebreaker after a tied final', () => {
		const event = fixtureBundle('USMINOQ');
		const tied = replayBundle(event, replayStart('M10', event)!);
		const captain = pitView({ bundle: tied, analysis: null, queue: null, team: 21331 });
		expect(captain.next?.label).toBe('M10-2');
		expect(captain.playoff?.position).toBe('Finals');
		const replayed = replayBundle(event, replayStart('M10-2', event)!);
		expect(
			pitView({ bundle: replayed, analysis: null, queue: null, team: 10137 }).next?.label
		).toBe('M11');
	});

	it('says whose picks the available list is sorted for', () => {
		const analysis = {
			ratings: [],
			forecasts: {},
			timing: { cycleSeconds: null, delaySeconds: null, onField: null, next: null, matches: {} },
			projections: null,
			playoffs: [],
			picks: { seed: 4, options: [{ team: 2844 }] }
		} as unknown as EventAnalysis;
		const window = selectionWindow(full)!;
		const picking = view((window.start + window.end) / 2, analysis);
		expect(picking.picksFor).toBe(4);
		expect(picking.available[0].number).toBe(2844);
		expect(view((window.start + window.end) / 2).picksFor).toBeNull();
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

	it('names the finals at a two-alliance event', () => {
		const finals = fixtureBundle('USALATQ');
		const first = replayBundle(finals, replayStart('F1', finals)!);
		const runnerUp = pitView({ bundle: first, analysis: null, queue: null, team: 24378 });
		expect(runnerUp.next?.label).toBe('F2');
		expect(runnerUp.playoff?.position).toBe('Finals');
		const done = replayBundle(finals, replayStart('F2', finals)!);
		expect(playoffResult(pitView({ bundle: done, analysis: null, queue: null, team: 24378 }))).toBe(
			'Finalist'
		);
	});

	it('ends with the final standings and awards', () => {
		const done = view(at('M10') + 20 * 60_000);
		expect(done.phase).toBe('done');
		expect(done.ranking?.rank).toBe(6);
		expect(done.standings.find((standing) => standing.won)?.seed).toBe(2);
		expect(done.eventAwards.length).toBeGreaterThan(10);
		expect(done.advancesTo).toBe('USAZCMP');
	});

	it('names the event a team advances to when it is known', () => {
		const named = {
			...full,
			advancement: { ...full.advancement!, advancesToName: 'Arizona Championship' }
		};
		expect(pitView({ bundle: named, analysis: null, queue: null, team: 26670 }).advancesTo).toBe(
			'Arizona Championship'
		);
	});

	it('does not call an ineligible team advancing', () => {
		const slots = full.advancement!.teams;
		const team = slots[0].team!;
		const ineligible = {
			...full,
			advancement: {
				...full.advancement!,
				teams: slots.map((slot, index) =>
					index === 0 ? { ...slot, status: 'ineligible' as const } : slot
				)
			}
		};
		expect(pitView({ bundle: full, analysis: null, queue: null, team }).advancing).toBe(true);
		expect(pitView({ bundle: ineligible, analysis: null, queue: null, team }).advancing).toBe(
			false
		);
	});

	it('names league teams that did not play at this meet', () => {
		const meet = fixtureBundle('USMIWMM8');
		const done = pitView({ bundle: meet, analysis: null, queue: null, team: 10104 });
		expect(done.names.get(24371)).toBe('Proto Pioneers');
		expect(done.names.get(10104)).toBe('That OTHER Team');
	});

	it('treats league teams that skipped the meet as not here', () => {
		const meet = fixtureBundle('USMIWMM8');
		const absent = pitView({ bundle: meet, analysis: null, queue: null, team: 24371 });
		expect(absent).toMatchObject({ registered: false, ranking: null, matches: [] });
		expect(absentText(absent).title).toBe('24371 is not at this meet.');
		const here = pitView({ bundle: meet, analysis: null, queue: null, team: 10104 });
		expect(here.registered).toBe(true);
		expect(
			absentText(pitView({ bundle: full, analysis: null, queue: null, team: 99999 })).title
		).toBe('99999 is not on the team list for this event.');
	});

	it('knows when a team is not at the event', () => {
		expect(pitView({ bundle: full, analysis: null, queue: null, team: 99999 }).registered).toBe(
			false
		);
	});
});

describe('delay copy', () => {
	it('says how far behind the field is', () => {
		expect(delayText(120)).toBe('The field is running 2 minutes behind.');
		expect(shortDelay(-300)).toBe('Field is 5 min ahead.');
	});

	it('drops the delay when matches carried over to the next day', () => {
		expect(delayText(894 * 60)).toBeNull();
		expect(shortDelay(894 * 60)).toBeNull();
	});
});

describe('rankWindow', () => {
	const rows = full.rankings;

	it('keeps short tables whole and trims long ones around us', () => {
		expect(rankWindow(rows, TEAM, 30)).toHaveLength(27);
		const top = rankWindow(rows, rows[2].team, 10);
		expect(top.slice(0, 9)).toEqual(rows.slice(0, 9));
		expect(top[9]).toEqual({ hidden: 18 });
		const trimmed = rankWindow(rows, rows[25].team, 12);
		expect(trimmed).toHaveLength(12);
		expect(trimmed[8]).toEqual({ hidden: 16 });
		expect(trimmed.slice(9)).toEqual(rows.slice(24, 27));
		const middle = rankWindow(rows, rows[15].team, 12);
		expect(middle.slice(7)).toEqual([{ hidden: 7 }, ...rows.slice(14, 17), { hidden: 10 }]);
	});

	it('changes signature only when the data does', () => {
		const a = replayBundle(full, at('Q22'));
		const b = replayBundle(full, at('Q22') + 30_000);
		expect(bundleSignature(a)).toBe(bundleSignature(b));
		expect(bundleSignature(replayBundle(full, at('Q23')))).not.toBe(bundleSignature(a));
	});
});
