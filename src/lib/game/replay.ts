import { tips } from '#lib/game/biobuzz.ts';
import { detectPhase } from '#lib/game/phase.ts';
import type {
	AllianceColor,
	AllianceSelection,
	EventBundle,
	Match,
	MatchResult,
	Ranking
} from '#lib/types.ts';

const MINUTE = 60_000;

export const SELECTION_DELAY = 10 * MINUTE;
export const SELECTION_LEAD = 15 * MINUTE;
export const AWARDS_DELAY = 15 * MINUTE;
export const LABEL_OFFSET = MINUTE;
export const MAX_SPEED = 600;

export interface ReplaySettings {
	start: number;
	speed: number;
}

export interface SelectionWindow {
	start: number;
	end: number;
}

export function revealTime(match: Match): number | null {
	return match.postedTime ?? match.actualTime ?? match.scheduledTime;
}

function latest(values: (number | null)[]): number | null {
	const known = values.filter((value): value is number => value !== null);
	return known.length > 0 ? Math.max(...known) : null;
}

function earliest(values: (number | null)[]): number | null {
	const known = values.filter((value): value is number => value !== null);
	return known.length > 0 ? Math.min(...known) : null;
}

function replayMatch(match: Match, at: number): Match {
	const posted = match.result ? revealTime(match) : null;
	return {
		...match,
		actualTime: match.actualTime !== null && match.actualTime <= at ? match.actualTime : null,
		postedTime: match.postedTime !== null && match.postedTime <= at ? match.postedTime : null,
		result: match.result && (posted === null || posted <= at) ? match.result : null
	};
}

export function selectionWindow(bundle: EventBundle): SelectionWindow | null {
	const quals = bundle.matches.filter((match) => match.level === 'qual');
	const playoffs = bundle.matches.filter((match) => match.level === 'playoff');
	const qualsDone = quals.length > 0 && quals.every((match) => match.result !== null);
	if (!qualsDone && bundle.alliances.length === 0) return null;
	const lastQual = latest(quals.map(revealTime));
	if (lastQual === null) return null;
	const start = lastQual + SELECTION_DELAY;
	const firstPlayoff = earliest(playoffs.map((match) => match.scheduledTime ?? match.actualTime));
	const end =
		firstPlayoff === null
			? start + 10 * MINUTE
			: Math.max(start + 5 * MINUTE, firstPlayoff - SELECTION_LEAD);
	return { start, end };
}

export interface SelectionStep {
	seed: number;
	round: number;
}

export function selectionSteps(alliances: AllianceSelection[]): SelectionStep[] {
	const ordered = [...alliances].sort((a, b) => a.seed - b.seed);
	const rounds = Math.max(0, ...ordered.map((alliance) => alliance.picks.length));
	const steps: SelectionStep[] = [];
	for (let round = 1; round <= rounds; round++) {
		const order = round % 2 === 0 ? [...ordered].reverse() : ordered;
		for (const alliance of order) {
			if (alliance.picks.length >= round) steps.push({ seed: alliance.seed, round });
		}
	}
	return steps;
}

export function replayAlliances(
	alliances: AllianceSelection[],
	window: SelectionWindow | null,
	at: number
): AllianceSelection[] {
	if (!window || at < window.start) return [];
	if (at >= window.end) return alliances;
	const steps = selectionSteps(alliances);
	const span = window.end - window.start;
	const made = Math.min(steps.length, Math.floor(((at - window.start) / span) * steps.length));
	const indexOf = (seed: number, round: number) =>
		steps.findIndex((step) => step.seed === seed && step.round === round);
	return alliances
		.filter((alliance) => {
			const called = indexOf(alliance.seed, 1);
			return called !== -1 && called <= made;
		})
		.map((alliance) => ({
			...alliance,
			picks: alliance.picks.filter((_, index) => indexOf(alliance.seed, index + 1) < made),
			backup: null,
			backupReplaced: null
		}));
}

interface Totals {
	team: number;
	rp: number;
	np: number;
	tips: number;
	auto: number;
	wins: number;
	losses: number;
	ties: number;
	played: number;
	dq: number;
}

function rankingPoints(result: MatchResult, color: AllianceColor): number {
	const outcome = result.winner === color ? 3 : result.winner === null ? 1 : 0;
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

export function computeRankings(matches: Match[], teams: number[] = []): Ranking[] {
	const totals = new Map<number, Totals>();
	const entry = (team: number) => {
		let value = totals.get(team);
		if (!value) {
			value = {
				team,
				rp: 0,
				np: 0,
				tips: 0,
				auto: 0,
				wins: 0,
				losses: 0,
				ties: 0,
				played: 0,
				dq: 0
			};
			totals.set(team, value);
		}
		return value;
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
			for (const slot of match[color]) {
				if (slot.surrogate) continue;
				const stats = entry(slot.team);
				const disqualified = slot.dq || slot.noShow;
				stats.played++;
				if (disqualified) stats.dq++;
				if (result.winner === color) stats.wins++;
				else if (result.winner === null) stats.ties++;
				else stats.losses++;
				if (disqualified) continue;
				stats.rp += points;
				stats.np += score.preFoulTotal;
				stats.tips += alliance;
				stats.auto += score.auto;
			}
		}
	}
	const rows = [...totals.values()].map((stats) => ({
		team: stats.team,
		rs: average(stats.rp, stats.played),
		tbp: average(stats.np, stats.played),
		avgTips: average(stats.tips, stats.played),
		avgAuto: average(stats.auto, stats.played),
		wins: stats.wins,
		losses: stats.losses,
		ties: stats.ties,
		played: stats.played,
		dq: stats.dq
	}));
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

export function replayBundle(bundle: EventBundle, at: number): EventBundle {
	const window = selectionWindow(bundle);
	const alliances = replayAlliances(bundle.alliances, window, at);
	const playoffsVisible = window !== null && at >= window.end;
	const matches = bundle.matches
		.filter((match) => match.level === 'qual' || playoffsVisible)
		.map((match) => replayMatch(match, at));
	const quals = matches.filter((match) => match.level === 'qual');
	const allQualsPosted = quals.length > 0 && quals.every((match) => match.result !== null);
	const lastPosted = latest(
		bundle.matches.map((match) => (match.result ? revealTime(match) : null))
	);
	const awardsVisible = lastPosted !== null && at >= lastPosted + AWARDS_DELAY;
	const awards = awardsVisible ? bundle.awards : [];
	const anyPosted = quals.some((match) => match.result !== null);
	const rankings =
		allQualsPosted && bundle.rankings.length > 0
			? bundle.rankings
			: anyPosted
				? computeRankings(
						quals,
						bundle.teams.map((team) => team.number)
					)
				: [];
	return {
		...bundle,
		matches,
		rankings,
		alliances,
		awards,
		advancement: awardsVisible ? bundle.advancement : null,
		phase: detectPhase({
			event: bundle.event,
			matches,
			alliances,
			awards,
			now: at,
			endsAt: null
		}),
		fetchedAt: at,
		stale: false
	};
}

const OFFSET = /(?:z|[+-]\d{2}:?\d{2})$/i;
const LOCAL = /^\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/i;

function zoneOffset(instant: number, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(new Date(instant));
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((item) => item.type === type)?.value ?? 0);
	const wall = Date.UTC(
		part('year'),
		part('month') - 1,
		part('day'),
		part('hour'),
		part('minute'),
		part('second')
	);
	return wall - Math.floor(instant / 1000) * 1000;
}

export function parseReplayTime(value: string, timeZone: string): number | null {
	const text = value.trim();
	if (OFFSET.test(text)) {
		const parsed = Date.parse(text);
		return Number.isNaN(parsed) ? null : parsed;
	}
	if (!LOCAL.test(text)) return null;
	const naive = Date.parse(`${text.replace(' ', 'T')}Z`);
	if (Number.isNaN(naive)) return null;
	try {
		const guess = naive - zoneOffset(naive, timeZone);
		return naive - zoneOffset(guess, timeZone);
	} catch {
		return naive;
	}
}

export function replayStart(value: string, bundle: EventBundle): number | null {
	const label = value.trim().toUpperCase();
	const match = bundle.matches.find(
		(item) => item.label.toUpperCase() === label || item.key.toUpperCase() === label
	);
	if (match) {
		const time = revealTime(match);
		return time === null ? null : time + LABEL_OFFSET;
	}
	return parseReplayTime(value, bundle.event.timezone);
}

export function replaySpeed(value: string | null): number {
	const speed = Number(value);
	return Number.isFinite(speed) && speed > 0 ? Math.min(speed, MAX_SPEED) : 1;
}

export function replaySettings(
	params: URLSearchParams,
	bundle: EventBundle
): ReplaySettings | null {
	const flag = params.get('replay');
	if (!flag || flag === '0' || flag === 'false') return null;
	const at = params.get('at');
	const start = at ? replayStart(at, bundle) : null;
	const fallback = earliest(bundle.matches.map((match) => match.scheduledTime));
	const begin = start ?? (fallback === null ? null : fallback - 30 * MINUTE);
	if (begin === null) return null;
	return { start: begin, speed: replaySpeed(params.get('speed')) };
}

export function replayClock(settings: ReplaySettings, origin: number, now: number): number {
	return settings.start + Math.max(0, now - origin) * settings.speed;
}
