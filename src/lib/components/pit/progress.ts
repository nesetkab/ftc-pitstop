import type { EventAnalysis } from '#lib/analysis/types.ts';
import { sideOf } from '#lib/components/event/matches.ts';
import { bracketDecided } from '#lib/game/phase.ts';
import type { AllianceSelection, EventBundle, Match, QueueStatusSnapshot } from '#lib/types.ts';

export interface AllianceStanding {
	seed: number;
	teams: number[];
	wins: number;
	losses: number;
	out: boolean;
	won: boolean;
}

export function isUnplayed(match: Match): boolean {
	return match.actualTime === null && match.result === null;
}

export function expectedStart(
	key: string,
	analysis: EventAnalysis | null,
	queue: QueueStatusSnapshot | null
): number | null {
	const times = queue?.matches.find((item) => item.key === key)?.times;
	return (
		times?.estimatedStart ??
		times?.estimatedOnField ??
		analysis?.timing.matches[key]?.expectedStart ??
		null
	);
}

export function postTime(match: Match): number {
	return match.postedTime ?? match.actualTime ?? match.scheduledTime ?? 0;
}

export function factualDelay(matches: Match[]): number | null {
	const started = matches.filter(
		(match) => match.actualTime !== null && match.scheduledTime !== null
	);
	const last = started.at(-1);
	if (!last) return null;
	return Math.round((last.actualTime! - last.scheduledTime!) / 1000);
}

export function currentPick(alliances: AllianceSelection[]): number | null {
	if (alliances.length === 0) return null;
	const most = Math.max(...alliances.map((alliance) => alliance.picks.length));
	const behind = alliances.filter((alliance) => alliance.picks.length < most);
	if (behind.length === 0) return most === 0 ? alliances[0].seed : null;
	const round = most;
	const ordered = round % 2 === 0 ? [...behind].reverse() : behind;
	return ordered[0].seed;
}

export function allianceTeams(alliance: AllianceSelection): number[] {
	return [alliance.captain, ...alliance.picks, ...(alliance.backup ? [alliance.backup] : [])];
}

export function standings(bundle: EventBundle): AllianceStanding[] {
	const playoffs = bundle.matches.filter((match) => match.level === 'playoff');
	if (bundle.alliances.length === 0) return [];
	const decided = bracketDecided(playoffs, bundle.alliances);
	const last = [...playoffs].reverse().find((match) => match.result);
	return bundle.alliances.map((alliance) => {
		const teams = allianceTeams(alliance);
		let wins = 0;
		let losses = 0;
		for (const match of playoffs) {
			const side = teams.map((team) => sideOf(match, team)).find((value) => value !== null);
			if (!side || !match.result) continue;
			if (match.result.winner === side) wins++;
			else if (match.result.winner !== null) losses++;
		}
		const won =
			decided &&
			last !== undefined &&
			teams.some((team) => sideOf(last, team) === last.result?.winner);
		return { seed: alliance.seed, teams, wins, losses, out: !won && (losses >= 2 || decided), won };
	});
}

export function bundleSignature(bundle: EventBundle): string {
	const posted = bundle.matches.filter((match) => match.result !== null).length;
	const started = bundle.matches.filter((match) => match.actualTime !== null).length;
	const picks = bundle.alliances.reduce((sum, alliance) => sum + 1 + alliance.picks.length, 0);
	return [bundle.event.code, bundle.phase, bundle.matches.length, posted, started, picks].join(':');
}
