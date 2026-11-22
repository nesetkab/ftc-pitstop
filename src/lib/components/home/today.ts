import { detectPhase } from '#lib/game/phase.ts';
import type { Event, EventPhase, Match, Ranking, SeasonMatch } from '#lib/types.ts';

export interface EventLeader {
	team: number;
	name: string | null;
}

export interface EventProgress {
	phase: EventPhase;
	label: string;
	leader: EventLeader | null;
}

export interface ProgressInput {
	event: Pick<Event, 'type' | 'end' | 'timezone'>;
	matches: Match[];
	rankings: Ranking[];
	now: number;
	endsAt: number | null;
}

export type TodayState = 'live' | 'posted' | 'waiting' | 'done';

const STATE_ORDER: Record<TodayState, number> = { live: 0, posted: 1, waiting: 2, done: 3 };

function lastPlayed(matches: Match[]): number {
	return matches.reduce(
		(latest, match) => (match.result && match.number > latest ? match.number : latest),
		0
	);
}

function progressLabel(phase: EventPhase, quals: Match[]): string {
	if (phase === 'quals') return `Q${lastPlayed(quals)} of ${quals.length}`;
	if (phase === 'selection') return 'Alliance selection';
	if (phase === 'playoffs') return 'Playoffs';
	if (phase === 'done') return 'Done';
	return quals.length > 0 ? `${quals.length} quals scheduled` : 'Not started';
}

export function eventProgress(input: ProgressInput): EventProgress | null {
	const { matches, rankings } = input;
	if (matches.length === 0 && rankings.length === 0) return null;
	const phase = detectPhase({
		event: input.event,
		matches,
		alliances: [],
		awards: [],
		now: input.now,
		endsAt: input.endsAt
	});
	const quals = matches.filter((match) => match.level === 'qual');
	const top = rankings.find((ranking) => ranking.rank === 1);
	return {
		phase,
		label: progressLabel(phase, quals),
		leader: top ? { team: top.team, name: top.name ?? null } : null
	};
}

export function seasonProgress(matches: SeasonMatch[]): EventProgress | null {
	if (matches.some((match) => match.level === 'playoff')) {
		return { phase: 'playoffs', label: 'Playoffs', leader: null };
	}
	const last = matches.reduce(
		(latest, match) => (match.level === 'qual' && match.number > latest ? match.number : latest),
		0
	);
	return last > 0 ? { phase: 'quals', label: `Q${last} played`, leader: null } : null;
}

export function todayState(progress: EventProgress | null, hasMatches: boolean | null): TodayState {
	if (!progress) return hasMatches ? 'posted' : 'waiting';
	if (progress.phase === 'done') return 'done';
	if (progress.phase === 'upcoming') return 'waiting';
	return 'live';
}

export function compareToday(
	a: { state: TodayState; name: string },
	b: { state: TodayState; name: string }
): number {
	return STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name);
}
