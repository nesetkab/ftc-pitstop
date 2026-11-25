import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnalysisContext } from '../../src/lib/analysis/types.ts';
import {
	addSums,
	dayNumber,
	emptySums,
	matchSums,
	orderEvents,
	orderMatches,
	previousFrom,
	rateSeason,
	type PriorRel,
	type TeamState
} from '../../src/lib/model/opr.ts';
import previousSeason from '../../src/lib/model/previous-2025.json' with { type: 'json' };
import { SwarmBook } from '../../src/lib/model/rp.ts';
import { rated } from '../../src/lib/model/types.ts';
import { loadSeason } from './hist.ts';
import { prepSeason } from './prep.ts';
import { toModelEvent } from './production.ts';

const BUILT = '2026-11-19';
const OUT = join(import.meta.dirname, '..', '..', 'tests', 'fixtures', 'analysis', 'contexts.json');

const recorded = JSON.parse(await readFile(OUT, 'utf8')) as {
	contexts: Record<string, AnalysisContext>;
};
const all = prepSeason(await loadSeason(2026));
const starts = new Map(all.map((e) => [e.code, e.start]));
const events = orderEvents(all.filter((e) => e.end < BUILT).map(toModelEvent));
const previous = previousFrom(previousSeason);
const run = rateSeason(events, { previous });
const days = events.map((e) => dayNumber(e.start));
const sums = events.map((e) => matchSums(e.matches));
const history = new Map<number, { day: number; state: TeamState }[]>();
events.forEach((event, i) => {
	for (const [team, state] of run.events.get(event.code)!.rater.carry()) {
		const list = history.get(team) ?? [];
		list.push({ day: days[i], state });
		history.set(team, list);
	}
});

function contextFor(teams: number[], day: number): AnalysisContext {
	const states: Record<number, TeamState> = {};
	const known: Record<number, PriorRel> = {};
	for (const team of teams) {
		let state: TeamState | undefined;
		for (const entry of history.get(team) ?? []) if (entry.day < day) state = entry.state;
		const rel = previous.get(team);
		if (state) states[team] = state;
		else if (rel) known[team] = rel;
	}
	const total = emptySums();
	const book = new SwarmBook();
	events.forEach((event, i) => {
		if (days[i] >= day) return;
		addSums(total, sums[i]);
		const ordered = orderMatches(event.matches);
		book.enterEvent(event.code, [...new Set(ordered.flatMap((m) => [...m.red, ...m.blue]))]);
		for (const m of ordered) if (rated(m)) book.update(m);
	});
	return { teams, states, previous: known, sums: total, swarm: book.snapshot(teams) };
}

const contexts = Object.fromEntries(
	Object.entries(recorded.contexts).map(([code, old]) => [
		code,
		contextFor(old.teams, dayNumber(starts.get(code)!))
	])
);
for (const [code, c] of Object.entries(contexts))
	console.log(code, c.sums.w, Object.keys(c.states).length, Object.keys(c.previous).length);
await writeFile(
	OUT,
	`${JSON.stringify({ source: `FTCScout season 2026, built ${BUILT}`, contexts })}\n`
);
