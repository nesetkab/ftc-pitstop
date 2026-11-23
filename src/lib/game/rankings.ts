import { RANKING_POINTS, tips } from '#lib/game/biobuzz.ts';
import type {
	AllianceColor,
	Event,
	EventSummary,
	Match,
	MatchResult,
	Ranking
} from '#lib/types.ts';

export const LEAGUE_MATCHES = 10;

interface Played {
	rp: number;
	np: number;
	tips: number;
	auto: number;
	outcome: 'win' | 'loss' | 'tie';
	zeroed: boolean;
}

export interface RankingOptions {
	best?: number;
}

function rankingPoints(result: MatchResult, color: AllianceColor): number {
	const outcome =
		result.winner === color ? RANKING_POINTS.win : result.winner === null ? RANKING_POINTS.tie : 0;
	const rp = result[color].breakdown?.rp;
	return (
		outcome +
		Number(rp?.swarm ?? false) +
		Number(rp?.pollinator1 ?? false) +
		Number(rp?.pollinator2 ?? false)
	);
}

function average(total: number, count: number): number {
	return count > 0 ? total / count : 0;
}

function sum(rows: Played[], pick: (row: Played) => number): number {
	return rows.reduce((total, row) => total + pick(row), 0);
}

function strongerMatch(a: Played, b: Played): number {
	return b.rp - a.rp || b.np - a.np || b.tips - a.tips || b.auto - a.auto;
}

export function computeRankings(
	matches: Match[],
	teams: number[] = [],
	options: RankingOptions = {}
): Ranking[] {
	const played = new Map<number, Played[]>();
	const entry = (team: number) => {
		let list = played.get(team);
		if (!list) {
			list = [];
			played.set(team, list);
		}
		return list;
	};
	for (const team of teams) entry(team);
	for (const match of matches) {
		if (match.level !== 'qual') continue;
		for (const color of ['red', 'blue'] as const) {
			for (const slot of match[color]) entry(slot.team);
		}
		const result = match.result;
		if (!result) continue;
		for (const color of ['red', 'blue'] as const) {
			const score = result[color];
			const points = rankingPoints(result, color);
			const alliance = score.breakdown ? tips(score.breakdown) : 0;
			const outcome = result.winner === color ? 'win' : result.winner === null ? 'tie' : 'loss';
			for (const slot of match[color]) {
				if (slot.surrogate) continue;
				const zeroed = slot.dq || slot.noShow;
				entry(slot.team).push({
					rp: zeroed ? 0 : points,
					np: zeroed ? 0 : score.preFoulTotal,
					tips: zeroed ? 0 : alliance,
					auto: zeroed ? 0 : score.auto,
					outcome,
					zeroed
				});
			}
		}
	}
	const best = options.best;
	const rows = [...played].map(([team, list]) => {
		const counted = best ? [...list].sort(strongerMatch).slice(0, best) : list;
		const divisor = best ?? list.length;
		const mean = (pick: (row: Played) => number) => average(sum(counted, pick), divisor);
		return {
			team,
			rs: mean((row) => row.rp),
			tbp: mean((row) => row.np),
			avgTips: mean((row) => row.tips),
			avgAuto: mean((row) => row.auto),
			wins: counted.filter((row) => row.outcome === 'win').length,
			losses: counted.filter((row) => row.outcome === 'loss').length,
			ties: counted.filter((row) => row.outcome === 'tie').length,
			played: list.length,
			dq: list.filter((row) => row.zeroed).length,
			...(best ? { counted: best } : {})
		};
	});
	rows.sort(
		(a, b) =>
			Number(b.played > 0) - Number(a.played > 0) ||
			b.rs - a.rs ||
			b.tbp - a.tbp ||
			b.avgTips - a.avgTips ||
			b.avgAuto - a.avgAuto ||
			a.team - b.team
	);
	return rows.map((row, index) => ({ rank: index + 1, ...row }));
}

export function isFirstLeagueMeet(event: Event, events: readonly EventSummary[] | null): boolean {
	if (event.type !== 'LeagueMeet' || !event.league || !events) return false;
	return !events.some(
		(other) =>
			other.code !== event.code &&
			other.type === 'LeagueMeet' &&
			other.region === event.region &&
			other.league === event.league &&
			other.hasMatches !== false &&
			other.start <= event.start
	);
}

export function rankingsFromMatches(
	event: Event,
	matches: Match[],
	teams: number[],
	events: readonly EventSummary[] | null
): Ranking[] {
	const best = isFirstLeagueMeet(event, events) ? LEAGUE_MATCHES : undefined;
	return computeRankings(matches, teams, { best }).filter((row) => row.played > 0);
}
