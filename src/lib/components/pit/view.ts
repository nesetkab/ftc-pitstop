import type { EventAnalysis, MatchForecast, MatchTiming, TeamRating } from '#lib/analysis/types.ts';
import { frontierIndex, nextMatchIndex, opposite, sideOf } from '#lib/components/event/matches.ts';
import { matchTitle, parseMatchDescription } from '#lib/format/match.ts';
import { hasPlayoffs } from '#lib/game/event-types.ts';
import { bracketDecided, WINNER_AWARD_ID } from '#lib/game/phase.ts';
import { fillPlayoffs } from './bracket.ts';
import { QUEUE_EARLIEST } from './queue.ts';
import type {
	AllianceColor,
	AllianceSelection,
	Award,
	EventBundle,
	EventPhase,
	Match,
	QueueStatus,
	QueueStatusSnapshot,
	Ranking
} from '#lib/types.ts';

export const FINALIST_AWARD_ID = 12;

export type Outcome = 'win' | 'loss' | 'tie';

export interface PitInput {
	bundle: EventBundle;
	analysis: EventAnalysis | null;
	queue: QueueStatusSnapshot | null;
	team: number;
}

export interface TeamSlot {
	number: number;
	name: string | null;
	opr: number | null;
	rank: number | null;
	me: boolean;
}

export interface PitMatch {
	key: string;
	label: string;
	level: Match['level'];
	title: string;
	alliance: AllianceColor;
	partners: number[];
	opponents: number[];
	scheduled: number | null;
	expected: number | null;
	started: number | null;
	outcome: Outcome | null;
	score: { ours: number; theirs: number } | null;
	win: number | null;
	surrogate: boolean;
}

export interface NextMatch extends PitMatch {
	red: TeamSlot[];
	blue: TeamSlot[];
	forecast: MatchForecast | null;
	queueAt: number | null;
	expectedStart: number | null;
	matchesAway: number;
	pending: string | null;
	nexus: { tracked: boolean; status: QueueStatus | null };
}

export interface LastResult {
	label: string;
	winner: AllianceColor | null;
	teams: number[];
	high: number;
	low: number;
}

export interface AvailableTeam {
	number: number;
	name: string | null;
	rank: number | null;
	rs: number | null;
	opr: number | null;
	winEvent: number | null;
}

export type AllianceRole = 'captain' | 'pick' | 'backup';

export interface AllianceStanding {
	seed: number;
	teams: number[];
	wins: number;
	losses: number;
	out: boolean;
	won: boolean;
}

export interface PlayoffView {
	alliance: AllianceSelection | null;
	wins: number;
	losses: number;
	state: 'waiting' | 'alive' | 'eliminated' | 'won';
	position: string | null;
	matches: PitMatch[];
	winEvent: number | null;
	finalist: boolean;
}

export interface PitView {
	team: number;
	teamName: string | null;
	phase: EventPhase;
	hasPlayoffs: boolean;
	registered: boolean;
	names: Map<number, string>;
	rankings: Ranking[];
	ranking: Ranking | null;
	teamCount: number;
	rankedAfter: string | null;
	qualsPlayed: number;
	qualsTotal: number;
	startsAt: number | null;
	matches: PitMatch[];
	next: NextMatch | null;
	firstMatch: PitMatch | null;
	onField: string | null;
	upNext: string | null;
	lastResult: LastResult | null;
	delaySeconds: number | null;
	opr: number | null;
	oprRank: number | null;
	top8: number | null;
	alliances: AllianceSelection[];
	alliance: AllianceSelection | null;
	role: AllianceRole | null;
	picking: number | null;
	available: AvailableTeam[];
	picksFor: number | null;
	playoff: PlayoffView | null;
	standings: AllianceStanding[];
	awards: Award[];
	eventAwards: Award[];
	advancing: boolean;
	advancesTo: string | null;
}

export function titleOf(match: Pick<Match, 'description' | 'label'>): string {
	const parsed = parseMatchDescription(match.description);
	return parsed ? matchTitle(parsed) : match.label;
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

function pitMatch(
	match: Match,
	team: number,
	analysis: EventAnalysis | null,
	queue: QueueStatusSnapshot | null
): PitMatch | null {
	const alliance = sideOf(match, team);
	if (!alliance) return null;
	const other = opposite(alliance);
	const result = match.result;
	const outcome: Outcome | null = !result
		? null
		: result.winner === null
			? 'tie'
			: result.winner === alliance
				? 'win'
				: 'loss';
	const forecast = analysis?.forecasts[match.key] ?? null;
	return {
		key: match.key,
		label: match.label,
		level: match.level,
		title: titleOf(match),
		alliance,
		partners: match[alliance].filter((slot) => slot.team !== team).map((slot) => slot.team),
		opponents: match[other].map((slot) => slot.team),
		scheduled: match.scheduledTime,
		expected: isUnplayed(match) ? expectedStart(match.key, analysis, queue) : null,
		started: match.actualTime,
		outcome,
		score: result ? { ours: result[alliance].total, theirs: result[other].total } : null,
		win: forecast ? forecast[alliance].win : null,
		surrogate: match[alliance].find((slot) => slot.team === team)?.surrogate ?? false
	};
}

export function postTime(match: Match): number {
	return match.postedTime ?? match.actualTime ?? match.scheduledTime ?? 0;
}

function lastResultOf(matches: Match[]): LastResult | null {
	let last: Match | null = null;
	for (const match of matches) {
		if (match.result && (!last || postTime(match) >= postTime(last))) last = match;
	}
	if (!last?.result) return null;
	const { red, blue, winner } = last.result;
	const side = winner ?? 'red';
	return {
		label: last.label,
		winner,
		teams: last[side].map((slot) => slot.team),
		high: Math.max(red.total, blue.total),
		low: Math.min(red.total, blue.total)
	};
}

function onFieldLabel(
	bundle: EventBundle,
	queue: QueueStatusSnapshot | null,
	analysis: EventAnalysis | null
) {
	const labels = new Map(bundle.matches.map((match) => [match.key, match.label]));
	const nexus = queue?.matches.filter((match) => match.status === 'on-field').at(-1);
	if (nexus) return (nexus.key && labels.get(nexus.key)) || nexus.label;
	const playing = bundle.matches.filter((match) => match.actualTime !== null && !match.result);
	if (playing.length > 0) return playing.at(-1)!.label;
	const timing = analysis?.timing.onField;
	if (timing) return labels.get(timing) ?? timing;
	return null;
}

function earliestScheduled(matches: Match[]): number | null {
	const times = matches
		.map((match) => match.scheduledTime)
		.filter((value): value is number => value !== null);
	return times.length > 0 ? Math.min(...times) : null;
}

function queueTime(timing: MatchTiming | undefined): number | null {
	if (!timing || timing.queueAt === null) return null;
	if (timing.expectedStart === null) return timing.queueAt;
	return Math.max(timing.queueAt, timing.expectedStart - QUEUE_EARLIEST);
}

export function factualDelay(matches: Match[]): number | null {
	const started = matches.filter(
		(match) => match.actualTime !== null && match.scheduledTime !== null
	);
	const last = started.at(-1);
	if (!last) return null;
	return Math.round((last.actualTime! - last.scheduledTime!) / 1000);
}

function allianceOf(alliances: AllianceSelection[], team: number) {
	for (const alliance of alliances) {
		if (alliance.captain === team) return { alliance, role: 'captain' as const };
		if (alliance.picks.includes(team)) return { alliance, role: 'pick' as const };
		if (alliance.backup === team) return { alliance, role: 'backup' as const };
	}
	return null;
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

function availableTeams(
	bundle: EventBundle,
	analysis: EventAnalysis | null,
	ratings: Map<number, TeamRating>,
	names: Map<number, string>
): AvailableTeam[] {
	const taken = new Set<number>();
	for (const alliance of bundle.alliances) {
		taken.add(alliance.captain);
		for (const pick of alliance.picks) taken.add(pick);
		if (alliance.backup) taken.add(alliance.backup);
	}
	const ranks = new Map(bundle.rankings.map((row) => [row.team, row]));
	const options = new Map(analysis?.picks?.options.map((option) => [option.team, option]));
	const numbers = bundle.rankings.length
		? bundle.rankings.map((row) => row.team)
		: bundle.teams.map((team) => team.number);
	const rows = numbers
		.filter((number) => !taken.has(number))
		.map((number) => ({
			number,
			name: names.get(number) ?? null,
			rank: ranks.get(number)?.rank ?? null,
			rs: ranks.get(number)?.rs ?? null,
			opr: ratings.get(number)?.opr ?? null,
			winEvent: options.get(number)?.winEvent ?? null
		}));
	if (options.size > 0) {
		const position = new Map([...options.keys()].map((team, index) => [team, index]));
		return rows.sort(
			(a, b) =>
				(position.get(a.number) ?? Infinity) - (position.get(b.number) ?? Infinity) ||
				(a.rank ?? Infinity) - (b.rank ?? Infinity)
		);
	}
	if (ratings.size > 0) return rows.sort((a, b) => (b.opr ?? -Infinity) - (a.opr ?? -Infinity));
	return rows;
}

function bracketPosition(match: Pick<Match, 'description' | 'label'>): string {
	const parsed = parseMatchDescription(match.description);
	if (parsed?.level === 'playoff' && parsed.bracket === 'final') return 'Finals';
	if (parsed?.level === 'playoff' && parsed.bracket && parsed.round) {
		return `${parsed.bracket === 'upper' ? 'Upper' : 'Lower'} bracket round ${parsed.round}`;
	}
	if (/^finals?\b/i.test(match.description.trim())) return 'Finals';
	return titleOf(match);
}

function playoffView(
	bundle: EventBundle,
	team: number,
	analysis: EventAnalysis | null,
	ours: PitMatch[]
): PlayoffView | null {
	const playoffs = bundle.matches.filter((match) => match.level === 'playoff');
	const membership = allianceOf(bundle.alliances, team);
	const matches = ours.filter((match) => match.level === 'playoff');
	if (!membership && matches.length === 0) return null;
	const wins = matches.filter((match) => match.outcome === 'win').length;
	const losses = matches.filter((match) => match.outcome === 'loss').length;
	const decided = bracketDecided(playoffs, bundle.alliances);
	const winnerAward = bundle.awards.some(
		(award) => award.id === WINNER_AWARD_ID && award.team === team
	);
	const finalMatch = [...playoffs].reverse().find((match) => match.result);
	const teams = membership ? allianceTeams(membership.alliance) : [team];
	const finalSide =
		decided && finalMatch
			? (teams.map((number) => sideOf(finalMatch, number)).find((side) => side !== null) ?? null)
			: null;
	const wonFinal = finalSide !== null && finalSide === finalMatch?.result?.winner;
	const won = winnerAward || wonFinal;
	const eliminated = !won && (losses >= 2 || decided);
	const finalistAward = bundle.awards.some(
		(award) => award.id === FINALIST_AWARD_ID && award.team === team
	);
	const next = matches.find((match) => match.outcome === null);
	const nextMatch = next && playoffs.find((match) => match.key === next.key);
	const lastMatch = [...matches].reverse().find((match) => match.outcome !== null);
	const state = won ? 'won' : eliminated ? 'eliminated' : matches.length > 0 ? 'alive' : 'waiting';
	let position: string | null = null;
	if (state === 'won') position = 'Won the event';
	else if (state === 'eliminated') position = lastMatch ? `Out after ${lastMatch.label}` : 'Out';
	else if (nextMatch) position = bracketPosition(nextMatch);
	const seed = membership?.alliance.seed;
	return {
		alliance: membership?.alliance ?? null,
		wins,
		losses,
		state,
		position,
		matches,
		winEvent:
			state === 'alive' || state === 'waiting'
				? (analysis?.playoffs?.find((odds) => odds.seed === seed)?.winEvent ?? null)
				: null,
		finalist: finalistAward || (!won && finalSide !== null)
	};
}

function allianceTeams(alliance: AllianceSelection): number[] {
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

export function pitView(input: PitInput): PitView {
	const { analysis, queue, team } = input;
	const filled = fillPlayoffs(input.bundle.matches, input.bundle.alliances);
	const bundle = { ...input.bundle, matches: filled.matches };
	const names = new Map([
		...bundle.rankings.flatMap((row) => (row.name ? [[row.team, row.name] as const] : [])),
		...bundle.teams.map((entry) => [entry.number, entry.name] as const)
	]);
	const ratings = new Map((analysis?.ratings ?? []).map((rating) => [rating.team, rating]));
	const ranks = new Map(bundle.rankings.map((row) => [row.team, row]));
	const quals = bundle.matches.filter((match) => match.level === 'qual');
	const postedQuals = quals.filter((match) => match.result !== null);
	const ours = bundle.matches
		.map((match) => pitMatch(match, team, analysis, queue))
		.filter((match): match is PitMatch => match !== null);
	const active = frontierIndex(bundle.matches);
	const nextIndex = nextMatchIndex(bundle.matches, team);
	let next: NextMatch | null = null;
	if (nextIndex !== -1) {
		const match = bundle.matches[nextIndex];
		const base = ours.find((item) => item.key === match.key)!;
		const timing = analysis?.timing.matches[match.key];
		const nexusMatch = queue?.matches.find((item) => item.key === match.key) ?? null;
		const nowQueuing = queue?.nowQueuing && nexusMatch && queue.nowQueuing === nexusMatch.label;
		const slot = (number: number): TeamSlot => ({
			number,
			name: names.get(number) ?? null,
			opr: ratings.get(number)?.opr ?? null,
			rank: ranks.get(number)?.rank ?? null,
			me: number === team
		});
		next = {
			...base,
			red: match.red.map((entry) => slot(entry.team)),
			blue: match.blue.map((entry) => slot(entry.team)),
			forecast: analysis?.forecasts[match.key] ?? null,
			queueAt: nexusMatch?.times.estimatedQueue ?? queueTime(timing),
			expectedStart: expectedStart(match.key, analysis, queue),
			matchesAway: bundle.matches.slice(active + 1, nextIndex).filter(isUnplayed).length,
			pending: filled.pending.get(match.key)?.[opposite(base.alliance)] ?? null,
			nexus: {
				tracked: nexusMatch !== null,
				status: nowQueuing ? 'now-queuing' : (nexusMatch?.status ?? null)
			}
		};
	}
	const membership = allianceOf(bundle.alliances, team);
	const rating = ratings.get(team);
	const standing = ranks.get(team);
	const live = bundle.phase !== 'upcoming' && bundle.phase !== 'done';
	const firstUnplayed = bundle.matches.find((match, index) => index > active && isUnplayed(match));
	const registered =
		bundle.teams.some((entry) => entry.number === team) ||
		ours.length > 0 ||
		(bundle.teams.length === 0 && ranks.has(team));
	return {
		team,
		teamName: names.get(team) ?? null,
		phase: bundle.phase,
		hasPlayoffs: hasPlayoffs(bundle.event.type),
		registered,
		names,
		rankings: bundle.rankings,
		ranking: registered && standing && standing.played > 0 ? standing : null,
		teamCount: bundle.rankings.length || bundle.teams.length,
		rankedAfter: postedQuals.at(-1)?.label ?? null,
		qualsPlayed: postedQuals.length,
		qualsTotal: quals.length,
		startsAt: earliestScheduled(bundle.matches),
		matches: ours,
		next,
		firstMatch: ours[0] ?? null,
		onField: live ? onFieldLabel(bundle, queue, analysis) : null,
		upNext: live ? (firstUnplayed?.label ?? null) : null,
		lastResult: lastResultOf(bundle.matches),
		delaySeconds: live ? (analysis?.timing.delaySeconds ?? factualDelay(bundle.matches)) : null,
		opr: rating?.opr ?? null,
		oprRank: rating?.rank ?? null,
		top8: analysis?.projections?.find((projection) => projection.team === team)?.top8 ?? null,
		alliances: bundle.alliances,
		alliance: membership?.alliance ?? null,
		role: membership?.role ?? null,
		picking: bundle.phase === 'selection' ? currentPick(bundle.alliances) : null,
		available: availableTeams(bundle, analysis, ratings, names),
		picksFor: analysis?.picks?.options.length ? analysis.picks.seed : null,
		playoff: playoffView(bundle, team, analysis, ours),
		standings: standings(bundle),
		awards: bundle.awards.filter((award) => award.team === team),
		eventAwards: bundle.awards.filter((award) => award.team !== null),
		advancing:
			bundle.advancement?.teams.some(
				(slot) => slot.team === team && !slot.declined && slot.status !== 'ineligible'
			) ?? false,
		advancesTo: bundle.advancement?.advancesToName ?? bundle.advancement?.advancesTo ?? null
	};
}

export interface RankGap {
	hidden: number;
}

export type RankRow = Ranking | RankGap;

export const ROW_FIT = { min: 0.7, max: 0.95, row: 1.75 };

export function isGap(row: RankRow): row is RankGap {
	return 'hidden' in row;
}

export function rowCapacity(height: number, em: number, row = ROW_FIT.row): number | null {
	if (!(height > 0) || !(em > 0)) return null;
	return Math.max(1, Math.floor(height / (em * ROW_FIT.min * row)) - 1);
}

export function rankWindow(rankings: Ranking[], team: number, size: number): RankRow[] {
	if (rankings.length <= size) return rankings;
	const index = rankings.findIndex((row) => row.team === team);
	if (index < size - 1) {
		const head = Math.max(0, size - 1);
		return [...rankings.slice(0, head), { hidden: rankings.length - head }];
	}
	for (const before of [1, 0]) {
		const start = Math.max(0, index - before);
		const end = Math.min(rankings.length, index + 1 + before);
		const tail = rankings.length - end;
		const head = size - (end - start) - 1 - (tail > 0 ? 1 : 0);
		if (head < 1) continue;
		return [
			...rankings.slice(0, head),
			{ hidden: start - head },
			...rankings.slice(start, end),
			...(tail > 0 ? [{ hidden: tail }] : [])
		];
	}
	return [rankings[index]];
}

export function bundleSignature(bundle: EventBundle): string {
	const posted = bundle.matches.filter((match) => match.result !== null).length;
	const started = bundle.matches.filter((match) => match.actualTime !== null).length;
	const picks = bundle.alliances.reduce((sum, alliance) => sum + 1 + alliance.picks.length, 0);
	return [bundle.event.code, bundle.phase, bundle.matches.length, posted, started, picks].join(':');
}
