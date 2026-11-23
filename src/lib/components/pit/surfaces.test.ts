import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { retime } from '#lib/analysis/analyze.ts';
import type { EventAnalysis } from '#lib/analysis/types.ts';
import { nowView } from '#lib/components/event/now.ts';
import { createReporter } from '#lib/components/event/report.ts';
import { liveStatus } from '#lib/components/home/followed.ts';
import { replayBundle, revealTime } from '#lib/game/replay.ts';
import type { EventBundle } from '#lib/types.ts';
import { deriveSelection, takenLabels } from '#lib/workspace/selection.ts';
import { fixtureBundle } from './fixtures.ts';
import { pitView } from './view.ts';

const MINUTE = 60_000;
const EVENTS = readdirSync(join(process.cwd(), 'tests/fixtures/ftc/2026/'));
const BLANK = { forecasts: {}, ratings: [] } as unknown as EventAnalysis;

function teamsOf(bundle: EventBundle): number[] {
	return [...new Set(bundle.matches.flatMap((m) => [...m.red, ...m.blue].map((s) => s.team)))];
}

function moments(bundle: EventBundle): number[] {
	const times = bundle.matches.flatMap((match) =>
		[match.scheduledTime, revealTime(match)].filter((time): time is number => time !== null)
	);
	if (times.length === 0) return [];
	const start = Math.min(...times) - 30 * MINUTE;
	const end = Math.max(...times) + 30 * MINUTE;
	const list: number[] = [];
	for (let time = start; time <= end; time += Math.max(5 * MINUTE, (end - start) / 120)) {
		list.push(time);
	}
	return list;
}

function disagreements(full: EventBundle, now: number): string[] {
	const bundle = replayBundle(full, now);
	const analysis = retime(BLANK, bundle, now);
	const live = nowView({ bundle, analysis, queue: null, baseline: null, now });
	const report = createReporter({ bundle, analysis, season: null, seasonCount: null });
	const shown = [live.onField, ...live.upcoming].filter((match) => match !== null);
	const crossed = takenLabels(deriveSelection(bundle.alliances));
	const problems: string[] = [];
	for (const team of teamsOf(full)) {
		const say = (text: string) => problems.push(`${full.event.code} ${team} ${text}`);
		const pit = pitView({ bundle, analysis, queue: null, team });
		const home = liveStatus(bundle, team, now);
		const card = report(team);
		const row = bundle.rankings.find((entry) => entry.team === team) ?? null;
		const standing = live.standings.find((entry) => entry.team === team);
		if (pit.ranking && row && pit.ranking.rank !== row.rank) say('pit rank differs from table');
		if (standing && row && (standing.rank !== row.rank || standing.rs !== row.rs)) {
			say('now standing differs from table');
		}
		if (pit.ranking && row && pit.ranking.rs !== row.rs) say('pit RS differs from table');
		if (pit.ranking && home.rank !== pit.ranking.rank) {
			say(`home rank ${home.rank} vs pit ${pit.ranking.rank}`);
		}
		if (pit.ranking && home.record !== `${row?.wins}-${row?.losses}-${row?.ties}`) {
			say(`home record ${home.record} differs from table`);
		}
		if (crossed.has(team) && pit.available.some((entry) => entry.number === team)) {
			say(`pick list crosses off ${team} but the pit lists it as available`);
		}
		if (pit.ranking && card?.ranking?.rank !== pit.ranking.rank) {
			say(`report rank ${card?.ranking?.rank} vs pit ${pit.ranking.rank}`);
		}
		if (pit.ranking && home.teams !== pit.teamCount) {
			say(`home of ${home.teams} vs pit of ${pit.teamCount}`);
		}
		if (pit.ranking && card && card.rankedOf !== pit.teamCount) {
			say(`report of ${card.rankedOf} vs pit of ${pit.teamCount}`);
		}
		if (pit.ranking === null && home.rank !== null && bundle.phase !== 'done') {
			say(`home rank ${home.rank} where pit shows none`);
		}
		const next = pit.next;
		if (bundle.phase === 'done') continue;
		if ((home.next?.key ?? null) !== (next?.key ?? null)) {
			say(`home next ${home.next?.key} vs pit ${next?.key}`);
		}
		if (next && !card?.upcoming.some((match) => match.key === next.key)) {
			say(`report leaves out our next match ${next.label}`);
		}
		if (!next || next.started !== null) continue;
		const listed = shown.find((match) => match.key === next.key);
		if (listed && listed.expected !== next.expectedStart) {
			say(`now ~${listed.expected} vs pit ~${next.expectedStart} for ${next.label}`);
		}
		if (home.next?.key === next.key && next.expectedStart !== null && home.next.at !== null) {
			if (Math.abs(home.next.at - next.expectedStart) > MINUTE) {
				say(
					`home ${new Date(home.next.at).toISOString()} vs pit ${new Date(next.expectedStart).toISOString()} for ${next.label}`
				);
			}
		}
		const time = card?.upcoming.find((match) => match.key === next.key)?.time ?? null;
		if (next.expectedStart !== null && time !== next.expectedStart) {
			say(`report time ${time} vs pit ${next.expectedStart}`);
		}
	}
	return problems.map((text) => `${new Date(now).toISOString()} ${text}`);
}

describe('every surface reads one snapshot the same way', () => {
	it.each(EVENTS)('%s agrees across pit, Now, home and report', (code) => {
		const full = fixtureBundle(code);
		const problems = new Set<string>();
		for (const now of moments(full))
			for (const problem of disagreements(full, now)) problems.add(problem);
		expect([...problems].slice(0, 30)).toEqual([]);
	});
});
