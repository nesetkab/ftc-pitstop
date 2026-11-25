import { retime } from '#lib/analysis/analyze.ts';
import type { EventAnalysis, MatchForecast } from '#lib/analysis/types.ts';
import { UPSET_CHANCE } from '#lib/components/home/highlights.ts';
import { fillPlayoffs } from '#lib/components/pit/bracket.ts';
import {
	bundleSignature,
	currentPick,
	expectedStart,
	factualDelay,
	isUnplayed,
	postTime,
	standings,
	type AllianceStanding
} from '#lib/components/pit/progress.ts';
import { hasPlayoffs } from '#lib/game/event-types.ts';
import { allianceCountFor } from '#lib/model/bracket.ts';
import type {
	AllianceColor,
	AllianceSelection,
	EventBundle,
	EventPhase,
	Match,
	QueueStatus,
	QueueStatusSnapshot
} from '#lib/types.ts';
import { titleOf } from './matches.ts';

export const UPCOMING_COUNT = 5;
export const RESULT_COUNT = 5;
export const TOP_COUNT = 8;
export const CLOSE_MARGIN = 5;
export const CLOSE_SHARE = 0.05;
export const RELOAD_GAP = 30_000;
export const LAYOUT_LAG = 120_000;

export type NowStatus = QueueStatus | 'playing';

export interface NowMatch {
	key: string;
	label: string;
	title: string;
	level: Match['level'];
	red: number[];
	blue: number[];
	pending: { red: string | null; blue: string | null };
	scheduled: number | null;
	expected: number | null;
	started: number | null;
	status: NowStatus | null;
	forecast: MatchForecast | null;
}

export type ResultTag = 'upset' | 'close' | 'tie';

export interface NowResult {
	key: string;
	label: string;
	red: number[];
	blue: number[];
	redScore: number;
	blueScore: number;
	winner: AllianceColor | null;
	chance: number | null;
	tags: ResultTag[];
}

export interface NowStanding {
	rank: number;
	team: number;
	name: string | null;
	rs: number;
	wins: number;
	losses: number;
	ties: number;
	move: number | null;
}

export interface RankSnapshot {
	after: string;
	ranks: Record<number, number>;
}

export interface SelectionStatus {
	state: 'next' | 'picking' | 'done';
	spots: number;
	picking: number | null;
	alliances: AllianceSelection[];
}

export interface PlayoffStanding extends AllianceStanding {
	winEvent: number | null;
}

export interface NowView {
	phase: EventPhase;
	onField: NowMatch | null;
	upcoming: NowMatch[];
	delaySeconds: number | null;
	startsAt: number | null;
	results: NowResult[];
	standings: NowStanding[];
	since: string | null;
	rankedAfter: string | null;
	qualsPlayed: number;
	qualsTotal: number;
	selection: SelectionStatus | null;
	playoffs: PlayoffStanding[];
	champion: PlayoffStanding | null;
}

export interface NowInput {
	bundle: EventBundle;
	analysis: EventAnalysis | null;
	queue: QueueStatusSnapshot | null;
	baseline: RankSnapshot | null;
	now: number;
}

const teamsOf = (slots: Match['red']) => slots.map((slot) => slot.team);

function postedQuals(matches: Match[]): Match[] {
	return matches
		.filter((match) => match.level === 'qual' && match.result !== null)
		.sort((a, b) => a.number - b.number);
}

function queueStatus(match: Match, queue: QueueStatusSnapshot | null): NowStatus | null {
	if (match.actualTime !== null && match.result === null) return 'playing';
	const item = queue?.matches.find((entry) => entry.key === match.key);
	if (!item) return null;
	if (queue?.nowQueuing && queue.nowQueuing === item.label) return 'now-queuing';
	return item.status;
}

function onFieldMatch(matches: Match[], queue: QueueStatusSnapshot | null): Match | null {
	const nexus = queue?.matches.filter((entry) => entry.status === 'on-field').at(-1);
	const tracked = nexus?.key ? matches.find((match) => match.key === nexus.key) : undefined;
	if (tracked && tracked.result === null) return tracked;
	return matches.findLast((match) => match.actualTime !== null && match.result === null) ?? null;
}

export function resultTags(
	result: NonNullable<Match['result']>,
	chance: number | null
): ResultTag[] {
	const high = Math.max(result.red.total, result.blue.total);
	const margin = Math.abs(result.red.total - result.blue.total);
	if (result.winner === null) return ['tie'];
	const tags: ResultTag[] = [];
	if (chance !== null && chance < UPSET_CHANCE) tags.push('upset');
	if (margin <= Math.max(CLOSE_MARGIN, high * CLOSE_SHARE)) tags.push('close');
	return tags;
}

function nowResult(match: Match, analysis: EventAnalysis | null): NowResult {
	const result = match.result!;
	const forecast = analysis?.forecasts[match.key];
	const chance = forecast && result.winner ? forecast[result.winner].win : null;
	return {
		key: match.key,
		label: match.label,
		red: teamsOf(match.red),
		blue: teamsOf(match.blue),
		redScore: result.red.total,
		blueScore: result.blue.total,
		winner: result.winner,
		chance,
		tags: resultTags(result, chance)
	};
}

export function rankSnapshot(
	bundle: Pick<EventBundle, 'matches' | 'rankings'>
): RankSnapshot | null {
	const last = postedQuals(bundle.matches).at(-1);
	if (!last || bundle.rankings.length === 0) return null;
	return {
		after: last.label,
		ranks: Object.fromEntries(bundle.rankings.map((row) => [row.team, row.rank]))
	};
}

export function nextBaseline(
	baseline: RankSnapshot | null,
	seen: RankSnapshot | null,
	current: RankSnapshot | null
): RankSnapshot | null {
	return current && seen && current.after !== seen.after ? seen : baseline;
}

function selectionStatus(bundle: EventBundle): SelectionStatus | null {
	if (bundle.phase !== 'selection' || !hasPlayoffs(bundle.event.type)) return null;
	const spots = allianceCountFor(bundle.rankings.length || bundle.teams.length);
	if (spots === 0) return null;
	const alliances = [...bundle.alliances].sort((a, b) => a.seed - b.seed);
	if (alliances.length === 0) return { state: 'next', spots, picking: null, alliances };
	const turn = currentPick(alliances) ?? (alliances.length < spots ? alliances.length + 1 : null);
	return { state: turn === null ? 'done' : 'picking', spots, picking: turn, alliances };
}

export function analysisBehind(analysis: EventAnalysis | null, bundle: EventBundle): boolean {
	if (!analysis) return false;
	return bundle.matches.some((match) => {
		const forecast = analysis.forecasts[match.key];
		return match.result !== null && (!forecast || !forecast.played);
	});
}

export interface ReloadInput {
	shown: EventBundle;
	latest: EventBundle;
	analysis: EventAnalysis | null;
	now: number;
	lastReload: number;
}

export function needsReload(input: ReloadInput): boolean {
	const { shown, latest, analysis, now, lastReload } = input;
	if (now - lastReload < RELOAD_GAP) return false;
	if (bundleSignature(latest) !== bundleSignature(shown)) return true;
	if (analysisBehind(analysis, latest)) return true;
	return latest.fetchedAt - shown.fetchedAt > LAYOUT_LAG;
}

export function nowView(input: NowInput): NowView {
	const { analysis, queue, baseline, now } = input;
	const filled = fillPlayoffs(input.bundle.matches, input.bundle.alliances);
	const bundle = { ...input.bundle, matches: filled.matches };
	const timed = analysis ? retime(analysis, input.bundle, now) : null;
	const names = new Map([
		...bundle.rankings.flatMap((row) => (row.name ? [[row.team, row.name] as const] : [])),
		...bundle.teams.map((team) => [team.number, team.name] as const)
	]);

	const nowMatch = (match: Match): NowMatch => ({
		key: match.key,
		label: match.label,
		title: titleOf(match),
		level: match.level,
		red: teamsOf(match.red),
		blue: teamsOf(match.blue),
		pending: {
			red: filled.pending.get(match.key)?.red ?? null,
			blue: filled.pending.get(match.key)?.blue ?? null
		},
		scheduled: match.scheduledTime,
		expected: isUnplayed(match) ? expectedStart(match.key, timed, queue) : null,
		started: match.actualTime,
		status: queueStatus(match, queue),
		forecast:
			match.red.length > 0 && match.blue.length > 0
				? (analysis?.forecasts[match.key] ?? null)
				: null
	});

	const matches = bundle.matches;
	const field = bundle.phase === 'done' ? null : onFieldMatch(matches, queue);
	const active = matches.findLastIndex(
		(match) => match.actualTime !== null || match.result !== null
	);
	const upcoming =
		bundle.phase === 'done'
			? []
			: matches
					.filter((match, index) => index > active && isUnplayed(match) && match !== field)
					.slice(0, UPCOMING_COUNT)
					.map(nowMatch);

	const times = matches
		.map((match) => match.scheduledTime)
		.filter((value): value is number => value !== null);
	const startsAt = times.length > 0 ? Math.min(...times) : null;
	const running =
		bundle.phase === 'quals' ||
		bundle.phase === 'playoffs' ||
		(bundle.phase === 'upcoming' && startsAt !== null && now >= startsAt);
	const delaySeconds = running
		? (timed?.timing.delaySeconds ??
			factualDelay(matches.filter((match) => match.level === 'qual')))
		: null;

	const results = matches
		.map((match, index) => ({ match, index }))
		.filter(({ match }) => match.result !== null)
		.sort((a, b) => postTime(b.match) - postTime(a.match) || b.index - a.index)
		.slice(0, RESULT_COUNT)
		.map(({ match }) => nowResult(match, analysis));

	const quals = matches.filter((match) => match.level === 'qual');
	const posted = postedQuals(matches);
	const moving = bundle.phase === 'quals' || bundle.phase === 'selection';
	const top = bundle.rankings.slice(0, TOP_COUNT).map((row) => {
		const was = moving ? baseline?.ranks[row.team] : undefined;
		return {
			rank: row.rank,
			team: row.team,
			name: names.get(row.team) ?? row.name ?? null,
			rs: row.rs,
			wins: row.wins,
			losses: row.losses,
			ties: row.ties,
			move: was === undefined ? null : was - row.rank
		};
	});

	const odds = new Map((analysis?.playoffs ?? []).map((entry) => [entry.seed, entry.winEvent]));
	const playoffs =
		bundle.phase === 'playoffs' || bundle.phase === 'done'
			? standings(bundle).map((standing) => ({
					...standing,
					winEvent: standing.out || standing.won ? null : (odds.get(standing.seed) ?? null)
				}))
			: [];

	return {
		phase: bundle.phase,
		onField: field ? nowMatch(field) : null,
		upcoming,
		delaySeconds,
		startsAt,
		results,
		standings: top,
		since: baseline && top.some((row) => row.move !== null) ? baseline.after : null,
		rankedAfter: posted.at(-1)?.label ?? null,
		qualsPlayed: posted.length,
		qualsTotal: quals.length,
		selection: selectionStatus(bundle),
		playoffs,
		champion: playoffs.find((standing) => standing.won) ?? null
	};
}
