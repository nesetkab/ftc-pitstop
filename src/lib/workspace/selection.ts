import type { AllianceOdds, EventAnalysis, PickOption } from '#lib/analysis/types.ts';
import { POINTS } from '#lib/game/biobuzz.ts';
import type { AllianceSelection, EventBundle, EventPhase, Match } from '#lib/types.ts';

export type AllianceProgress = 'complete' | 'picking' | 'waiting';

export interface AllianceView extends AllianceSelection {
	progress: AllianceProgress;
}

export type TeamStatus =
	| { kind: 'available'; captainOf: number | null }
	| { kind: 'captain'; alliance: number }
	| { kind: 'pick'; alliance: number }
	| { kind: 'backup'; alliance: number };

export interface SelectionState {
	alliances: AllianceView[];
	picking: AllianceView | null;
	round: number;
	rounds: number;
	started: boolean;
	complete: boolean;
	completed: number;
	status(team: number): TeamStatus;
}

export interface SelectionOptions {
	picksPerAlliance?: number;
}

export function deriveSelection(
	alliances: readonly AllianceSelection[],
	options: SelectionOptions = {}
): SelectionState {
	const sorted = [...alliances].sort((a, b) => a.seed - b.seed);
	const observed = sorted.reduce((most, alliance) => Math.max(most, alliance.picks.length), 0);
	const rounds = Math.max(options.picksPerAlliance ?? 1, observed);
	let round = 0;
	let current: AllianceSelection | null = null;
	for (let r = 1; r <= rounds && current === null; r++) {
		const order = r % 2 === 1 ? sorted : [...sorted].reverse();
		const next = order.find((alliance) => alliance.picks.length < r);
		if (next) {
			round = r;
			current = next;
		}
	}
	const views: AllianceView[] = sorted.map((alliance) => ({
		...alliance,
		progress:
			alliance.picks.length >= rounds ? 'complete' : alliance === current ? 'picking' : 'waiting'
	}));
	const statuses = new Map<number, TeamStatus>();
	for (const alliance of views) {
		statuses.set(
			alliance.captain,
			alliance.progress === 'waiting'
				? { kind: 'available', captainOf: alliance.seed }
				: { kind: 'captain', alliance: alliance.seed }
		);
	}
	for (const alliance of views) {
		for (const team of alliance.picks)
			statuses.set(team, { kind: 'pick', alliance: alliance.seed });
		if (alliance.backup) statuses.set(alliance.backup, { kind: 'backup', alliance: alliance.seed });
	}
	return {
		alliances: views,
		picking: views.find((alliance) => alliance.progress === 'picking') ?? null,
		round,
		rounds,
		started: views.length > 0,
		complete: views.length > 0 && current === null,
		completed: views.filter((alliance) => alliance.progress === 'complete').length,
		status: (team) => statuses.get(team) ?? { kind: 'available', captainOf: null }
	};
}

export function isTaken(status: TeamStatus): boolean {
	return status.kind !== 'available';
}

export function takenLabel(status: TeamStatus): string | null {
	if (status.kind === 'captain') return `Captain of alliance ${status.alliance}`;
	if (status.kind === 'pick') return `Picked by alliance ${status.alliance}`;
	if (status.kind === 'backup') return `Backup for alliance ${status.alliance}`;
	return null;
}

export function takenLabels(state: SelectionState): Map<number, string> {
	const labels = new Map<number, string>();
	for (const alliance of state.alliances) {
		const teams = [
			alliance.captain,
			...alliance.picks,
			...(alliance.backup ? [alliance.backup] : [])
		];
		for (const team of teams) {
			const label = takenLabel(state.status(team));
			if (label) labels.set(team, label);
		}
	}
	return labels;
}

export function refreshInterval(phase: EventPhase): number | null {
	if (phase === 'selection') return 10_000;
	if (phase === 'quals') return 30_000;
	if (phase === 'playoffs') return 60_000;
	return null;
}

export function bundleSignature(
	bundle: Pick<EventBundle, 'alliances' | 'matches' | 'phase'>
): string {
	const played =
		bundle.phase === 'playoffs'
			? bundle.matches.filter((match) => match.result !== null).length
			: 0;
	return JSON.stringify([bundle.phase, played, bundle.alliances]);
}

export function parkAverages(matches: readonly Match[]): Map<number, number> {
	const totals = new Map<number, { parks: number; played: number }>();
	for (const match of matches) {
		if (match.level !== 'qual' || !match.result) continue;
		for (const color of ['red', 'blue'] as const) {
			const breakdown = match.result[color].breakdown;
			if (!breakdown) continue;
			for (const entry of match[color]) {
				if (entry.surrogate || entry.noShow || entry.dq) continue;
				const slot = Math.min(Math.max(entry.station - 1, 0), 1);
				const total = totals.get(entry.team) ?? { parks: 0, played: 0 };
				total.parks += Number(breakdown.auto.park[slot]) + Number(breakdown.teleop.park[slot]);
				total.played += 1;
				totals.set(entry.team, total);
			}
		}
	}
	return new Map(
		[...totals].map(([team, total]) => [team, (total.parks * POINTS.park) / total.played])
	);
}

export interface TeamRow {
	team: number;
	name: string | null;
	status: TeamStatus;
	rank: number | null;
	rs: number | null;
	tbp: number | null;
	avgAuto: number | null;
	avgTips: number | null;
	avgPark: number | null;
	opr: number | null;
	autoOpr: number | null;
	winRound1: number | null;
	reachUpperFinal: number | null;
	winEvent: number | null;
	promotes: number | null;
}

export interface SelectionTable {
	available: TeamRow[];
	taken: TeamRow[];
	rated: boolean;
	picks: boolean;
	pickAlliance: number | null;
}

function descending(a: number | null, b: number | null): number {
	return (b ?? -Infinity) - (a ?? -Infinity) || 0;
}

function ascending(a: number | null, b: number | null): number {
	return (a ?? Infinity) - (b ?? Infinity) || 0;
}

const ROLE_ORDER = { captain: 0, pick: 1, backup: 2, available: 3 } as const;

function allianceOf(status: TeamStatus): number {
	return status.kind === 'available' ? Infinity : status.alliance;
}

export function selectionTable(
	bundle: Pick<EventBundle, 'teams' | 'rankings' | 'matches'>,
	analysis: EventAnalysis | null,
	state: SelectionState
): SelectionTable {
	const rankings = new Map(bundle.rankings.map((ranking) => [ranking.team, ranking]));
	const ratings = new Map((analysis?.ratings ?? []).map((rating) => [rating.team, rating]));
	const names = new Map(bundle.teams.map((team) => [team.number, team.name]));
	const parks = parkAverages(bundle.matches);
	const useful =
		analysis?.picks && state.picking && analysis.picks.seed === state.picking.seed
			? analysis.picks
			: null;
	const options = new Map<number, PickOption>((useful?.options ?? []).map((o) => [o.team, o]));
	const numbers = new Set<number>([
		...bundle.teams.map((team) => team.number),
		...rankings.keys(),
		...state.alliances.flatMap((alliance) => [
			alliance.captain,
			...alliance.picks,
			...(alliance.backup ? [alliance.backup] : [])
		])
	]);
	const rows: TeamRow[] = [...numbers].map((team) => {
		const option = options.get(team);
		const rating = ratings.get(team);
		const ranking = rankings.get(team);
		return {
			team,
			name: names.get(team) ?? null,
			status: state.status(team),
			rank: ranking?.rank ?? null,
			rs: ranking?.rs ?? null,
			tbp: ranking?.tbp ?? null,
			avgAuto: ranking?.avgAuto ?? null,
			avgTips: option?.tips ?? ranking?.avgTips ?? null,
			avgPark: option?.park ?? parks.get(team) ?? rating?.parts.park ?? null,
			opr: option?.opr ?? rating?.opr ?? null,
			autoOpr: option?.auto ?? rating?.parts.auto ?? null,
			winRound1: option?.winRound1 ?? null,
			reachUpperFinal: option?.reachUpperFinal ?? null,
			winEvent: option?.winEvent ?? null,
			promotes: option?.promotesCaptain ?? null
		};
	});
	const rated = (analysis?.ratings.length ?? 0) > 0;
	const available = rows
		.filter((row) => !isTaken(row.status))
		.sort((a, b) => {
			if (useful) {
				return (
					descending(a.winRound1, b.winRound1) ||
					descending(a.winEvent, b.winEvent) ||
					descending(a.opr, b.opr) ||
					ascending(a.rank, b.rank) ||
					a.team - b.team
				);
			}
			if (rated) return descending(a.opr, b.opr) || ascending(a.rank, b.rank) || a.team - b.team;
			return ascending(a.rank, b.rank) || a.team - b.team;
		});
	const taken = rows
		.filter((row) => isTaken(row.status))
		.sort(
			(a, b) =>
				allianceOf(a.status) - allianceOf(b.status) ||
				ROLE_ORDER[a.status.kind] - ROLE_ORDER[b.status.kind] ||
				a.team - b.team
		);
	return {
		available,
		taken,
		rated,
		picks: useful !== null,
		pickAlliance: useful?.seed ?? null
	};
}

export function formatSeeds(seeds: readonly number[]): string {
	const sorted = [...seeds].sort((a, b) => a - b);
	if (sorted.length === 1) return `Alliance ${sorted[0]}`;
	const consecutive = sorted.every((seed, index) => index === 0 || seed === sorted[index - 1] + 1);
	if (consecutive && sorted.length > 2) return `Alliances ${sorted[0]} to ${sorted.at(-1)}`;
	const head = sorted.slice(0, -1).join(', ');
	return `Alliances ${head} and ${sorted.at(-1)}`;
}

export interface OddsRow {
	label: string;
	seeds: number[];
	chance: number;
}

const ODDS_FLOOR = 0.005;

export function oddsRows(odds: readonly AllianceOdds[]): OddsRow[] {
	const sorted = [...odds].sort((a, b) => b.winEvent - a.winEvent || a.seed - b.seed);
	const likely = sorted.filter((row) => row.winEvent >= ODDS_FLOOR);
	const unlikely = sorted.filter((row) => row.winEvent < ODDS_FLOOR);
	const rows: OddsRow[] = likely.map((row) => ({
		label: `Alliance ${row.seed}`,
		seeds: [row.seed],
		chance: row.winEvent
	}));
	if (unlikely.length === 1) {
		rows.push({
			label: `Alliance ${unlikely[0].seed}`,
			seeds: [unlikely[0].seed],
			chance: unlikely[0].winEvent
		});
	} else if (unlikely.length > 1) {
		const seeds = unlikely.map((row) => row.seed);
		rows.push({
			label: formatSeeds(seeds),
			seeds: seeds.sort((a, b) => a - b),
			chance: Math.max(...unlikely.map((row) => row.winEvent))
		});
	}
	return rows;
}
