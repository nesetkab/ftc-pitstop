import { hasPlayoffs } from '#lib/game/event-types.ts';
import type { AllianceSelection, Award, Event, EventPhase, Match } from '#lib/types.ts';

const HOUR = 3_600_000;

export const WINNER_AWARD_ID = 13;

export interface PhaseInput {
	event: Pick<Event, 'type'>;
	matches: Match[];
	alliances: AllianceSelection[];
	awards: Award[];
	now: number;
	endsAt: number | null;
}

function allianceIndex(alliances: AllianceSelection[]): Map<number, number> {
	const index = new Map<number, number>();
	for (const alliance of alliances) {
		for (const team of [alliance.captain, ...alliance.picks, alliance.backup]) {
			if (team) index.set(team, alliance.seed);
		}
	}
	return index;
}

function allianceId(teams: number[], index: Map<number, number>): string {
	for (const team of teams) {
		const seed = index.get(team);
		if (seed !== undefined) return `seed${seed}`;
	}
	return [...teams].sort((a, b) => a - b).join('+');
}

export function bracketDecided(playoffs: Match[], alliances: AllianceSelection[]): boolean {
	const index = allianceIndex(alliances);
	const losses = new Map<string, number>();
	for (const match of playoffs) {
		const red = allianceId(
			match.red.map((team) => team.team),
			index
		);
		const blue = allianceId(
			match.blue.map((team) => team.team),
			index
		);
		if (!losses.has(red)) losses.set(red, 0);
		if (!losses.has(blue)) losses.set(blue, 0);
		const winner = match.result?.winner;
		if (!winner) continue;
		const loser = winner === 'red' ? blue : red;
		losses.set(loser, (losses.get(loser) ?? 0) + 1);
	}
	const total = Math.max(alliances.length, losses.size);
	if (total < 2) return false;
	const alive = [...losses.values()].filter((count) => count < 2).length + (total - losses.size);
	return alive === 1;
}

function lastPosted(matches: Match[]): number | null {
	let latest: number | null = null;
	for (const match of matches) {
		const time = match.postedTime ?? match.actualTime;
		if (match.result && time !== null && (latest === null || time > latest)) latest = time;
	}
	return latest;
}

export function detectPhase(input: PhaseInput): EventPhase {
	const { event, matches, alliances, awards, now, endsAt } = input;
	const over = endsAt !== null && now >= endsAt;
	const quals = matches.filter((match) => match.level === 'qual');
	const playoffs = matches.filter((match) => match.level === 'playoff');
	const winnerAnnounced = awards.some((award) => award.id === WINNER_AWARD_ID);

	if (playoffs.length > 0) {
		if (winnerAnnounced || over || bracketDecided(playoffs, alliances)) return 'done';
		return 'playoffs';
	}
	if (alliances.length > 0) return over || winnerAnnounced ? 'done' : 'selection';
	if (quals.length === 0) return over ? 'done' : 'upcoming';

	const played = quals.filter((match) => match.result !== null).length;
	if (played === 0 && !quals.some((match) => match.actualTime !== null)) {
		return over ? 'done' : 'upcoming';
	}
	if (played < quals.length) return over ? 'done' : 'quals';
	if (over || winnerAnnounced || !hasPlayoffs(event.type)) return 'done';
	const last = lastPosted(quals);
	if (last !== null && now - last > 2 * HOUR) return 'done';
	return 'selection';
}
