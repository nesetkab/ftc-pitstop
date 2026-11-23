import { timeZoneOffset } from '#lib/format/calendar.ts';
import { detectPhase } from '#lib/game/phase.ts';
import { computeRankings } from '#lib/game/rankings.ts';
import type { AllianceSelection, EventBundle, Match } from '#lib/types.ts';

export { computeRankings };

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

function teamsOf(slots: Match['red']): number[] {
	return slots.map((slot) => slot.team);
}

function playsBefore(earlier: Match, match: Match): boolean {
	return (
		earlier.series < match.series ||
		(earlier.series === match.series && earlier.number < match.number)
	);
}

function sideKnown(bundle: EventBundle, match: Match, slots: Match['red'], at: number): boolean {
	const teams = new Set(teamsOf(slots));
	return bundle.matches.every((earlier) => {
		if (earlier.level !== 'playoff' || !playsBefore(earlier, match)) return true;
		if (![...earlier.red, ...earlier.blue].some((slot) => teams.has(slot.team))) return true;
		const posted = earlier.result ? revealTime(earlier) : null;
		return posted !== null && posted <= at;
	});
}

function replayPlayoff(bundle: EventBundle, match: Match, at: number): Match | null {
	const red = sideKnown(bundle, match, match.red, at);
	const blue = sideKnown(bundle, match, match.blue, at);
	if (!red && !blue) return null;
	return { ...match, red: red ? match.red : [], blue: blue ? match.blue : [] };
}

export function replayBundle(bundle: EventBundle, at: number): EventBundle {
	const window = selectionWindow(bundle);
	const alliances = replayAlliances(bundle.alliances, window, at);
	const playoffsVisible = window !== null && at >= window.end;
	const matches = bundle.matches
		.map((match) =>
			match.level === 'qual' ? match : playoffsVisible ? replayPlayoff(bundle, match, at) : null
		)
		.filter((match): match is Match => match !== null)
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
		const guess = naive - timeZoneOffset(naive, timeZone);
		return naive - timeZoneOffset(guess, timeZone);
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
