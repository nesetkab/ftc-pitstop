import { fixed } from '#lib/format/number.ts';
import { ordinal } from '#lib/format/ordinal.ts';
import { pct } from '#lib/format/pct.ts';
import { record } from '#lib/format/record.ts';
import { relative } from '#lib/format/relative.ts';
import { time } from '#lib/format/time.ts';
import type { MatchListItem } from '#lib/ui/MatchList.svelte';
import type { AllianceColor } from '#lib/types.ts';
import type { QueueCall } from './queue.ts';
import type { LastResult, NextMatch, Outcome, PitMatch, PitView } from './view.ts';

export const OUTCOME: Record<Outcome, string> = { win: 'Won', loss: 'Lost', tie: 'Tied' };

export function colorName(color: AllianceColor): string {
	return color === 'red' ? 'Red' : 'Blue';
}

export function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

export function awayText(matches: number): string {
	if (matches <= 0) return 'next on the field';
	return matches === 1 ? '1 match from now' : `${matches} matches from now`;
}

export function delayText(seconds: number | null): string | null {
	if (seconds === null) return null;
	const minutes = Math.round(Math.abs(seconds) / 60);
	if (minutes === 0) return 'The field is on schedule.';
	const unit = minutes === 1 ? 'minute' : 'minutes';
	return `The field is running ${minutes} ${unit} ${seconds > 0 ? 'behind' : 'ahead'}.`;
}

export function shortDelay(seconds: number | null): string | null {
	if (seconds === null) return null;
	const minutes = Math.round(Math.abs(seconds) / 60);
	if (minutes === 0) return 'Field is on schedule.';
	return `Field is ${minutes} min ${seconds > 0 ? 'behind' : 'ahead'}.`;
}

export interface HeroText {
	headline: string;
	detail: string[];
	urgent: boolean;
}

const NEXUS_HEADLINE = {
	'now-queuing': 'Queue now',
	'on-deck': 'On deck',
	'on-field': 'On the field'
} as const;

function present(values: (string | null)[]): string[] {
	return values.filter((value): value is string => Boolean(value));
}

export function heroText(
	next: NextMatch,
	call: QueueCall | null,
	now: number,
	timeZone: string,
	delaySeconds: number | null
): HeroText {
	if (next.started !== null) {
		return {
			headline: 'On the field now',
			detail: [`Started at ${time(next.started, timeZone)}.`],
			urgent: false
		};
	}
	const away = awayText(next.matchesAway);
	const field =
		next.expectedStart !== null
			? `On the field around ${time(next.expectedStart, timeZone)}, ${away}.`
			: `${capitalize(away)}.`;
	const delay = delayText(delaySeconds);
	const status = next.nexus.tracked ? next.nexus.status : null;
	if (call) {
		const headline =
			status && status !== 'queuing-soon' ? NEXUS_HEADLINE[status] : NEXUS_HEADLINE['now-queuing'];
		return { headline, detail: present([field, delay]), urgent: true };
	}
	if (next.queueAt !== null) {
		return {
			headline: `Queue at ${time(next.queueAt, timeZone)}`,
			detail: present([`${capitalize(relative(next.queueAt, now))}.`, field, delay]),
			urgent: false
		};
	}
	if (status === 'queuing-soon') {
		return { headline: 'Queuing soon', detail: present([field, delay]), urgent: false };
	}
	if (next.scheduled !== null) {
		return {
			headline: `Scheduled for ${time(next.scheduled, timeZone)}`,
			detail: present([field, delay]),
			urgent: false
		};
	}
	return { headline: capitalize(away), detail: present([delay]), urgent: false };
}

export function phoneDetail(
	next: NextMatch,
	timeZone: string,
	delaySeconds: number | null
): string {
	if (next.started !== null) return `Started at ${time(next.started, timeZone)}.`;
	const field =
		next.expectedStart !== null
			? `On the field around ${time(next.expectedStart, timeZone)}.`
			: `${capitalize(awayText(next.matchesAway))}.`;
	return present([field, shortDelay(delaySeconds)]).join(' ');
}

function withPartners(partners: number[]): string {
	return partners.length > 0 ? `with ${partners.join(', ')}` : '';
}

export function matchItem(
	match: PitMatch,
	nextKey: string | null,
	timeZone: string,
	href?: string
): MatchListItem {
	const partners = withPartners(match.partners);
	if (match.outcome && match.score) {
		return {
			label: match.label,
			status: OUTCOME[match.outcome],
			detail: match.surrogate ? present([partners, 'surrogate']).join(', ') : partners,
			value: `${match.score.ours}–${match.score.theirs}`,
			state: 'done',
			href
		};
	}
	const status =
		match.started !== null
			? 'On field'
			: match.scheduled !== null
				? time(match.scheduled, timeZone)
				: '';
	return {
		label: match.label,
		status,
		detail: present([colorName(match.alliance), partners]).join(', '),
		value: match.win !== null ? pct(match.win) : '',
		state: match.key === nextKey ? 'next' : 'upcoming',
		href
	};
}

export function matchItems(
	matches: PitMatch[],
	nextKey: string | null,
	timeZone: string,
	limit = Infinity
): MatchListItem[] {
	let shown = matches;
	if (matches.length > limit) {
		const firstOpen = matches.findIndex((match) => match.outcome === null);
		const start =
			firstOpen === -1
				? matches.length - limit
				: Math.max(0, Math.min(firstOpen - 2, matches.length - limit));
		shown = matches.slice(start, start + limit);
	}
	return shown.map((match) => matchItem(match, nextKey, timeZone));
}

export function lastResultItem(result: LastResult): MatchListItem {
	return {
		label: result.label,
		status: result.winner === null ? 'Tie' : `${colorName(result.winner)} won`,
		detail: result.winner === null ? '' : result.teams.join(', '),
		value: `${result.high}–${result.low}`
	};
}

export function qualsDoneText(view: PitView): { headline: string; detail: string } {
	const scheduled = view.matches.some((match) => match.level === 'qual');
	const posted = `${view.qualsPlayed} of ${view.qualsTotal} qualification matches are posted.`;
	return {
		headline: scheduled
			? 'Our qualification matches are done.'
			: `No qualification matches for ${view.team}.`,
		detail: view.hasPlayoffs ? `${posted} Alliance selection comes next.` : posted
	};
}

export function roleText(view: PitView): string {
	const seed = view.alliance?.seed;
	if (view.role === 'captain') return `Captain of alliance ${seed}`;
	if (view.role === 'pick') return `Picked by alliance ${seed}`;
	if (view.role === 'backup') return `Backup for alliance ${seed}`;
	return view.alliances.length > 0 ? 'Not on an alliance yet' : 'Alliance selection is next';
}

export function standingText(view: PitView): string | null {
	const ranking = view.ranking;
	if (!ranking) return null;
	return `Ranked ${ordinal(ranking.rank)} of ${view.teamCount} at ${record(ranking.wins, ranking.losses, ranking.ties)} with an RS of ${fixed(ranking.rs, 2)}.`;
}

export interface Fact {
	label: string;
	value: string;
	detail?: string;
}

export function eventFacts(view: PitView): Fact[] {
	const ranking = view.ranking;
	const facts: Fact[] = [];
	facts.push(
		ranking
			? { label: 'Rank', value: String(ranking.rank), detail: `of ${view.teamCount}` }
			: { label: 'Rank', value: '—' }
	);
	facts.push({
		label: 'Record',
		value: ranking ? record(ranking.wins, ranking.losses, ranking.ties) : '0-0-0'
	});
	facts.push({ label: 'RS', value: ranking ? fixed(ranking.rs, 2) : '—' });
	if (view.opr !== null) {
		facts.push({ label: 'OPR', value: fixed(view.opr, 1) });
		if (view.oprRank !== null) {
			facts.push({
				label: 'OPR rank',
				value: String(view.oprRank),
				detail: `of ${view.teamCount}`
			});
		}
	} else {
		facts.push({ label: 'TBP', value: ranking ? fixed(ranking.tbp, 1) : '—' });
		const quals = view.matches.filter((match) => match.level === 'qual');
		facts.push({
			label: 'Played',
			value: String(quals.filter((match) => match.outcome !== null).length),
			detail: `of ${quals.length}`
		});
	}
	if (view.top8 !== null) facts.push({ label: 'Top 8 chance', value: pct(view.top8) });
	return facts.slice(0, 6);
}

export function playoffResult(view: PitView): string | null {
	const playoff = view.playoff;
	if (!playoff) return view.standings.length > 0 ? 'Not in the playoffs' : null;
	if (playoff.state === 'won') return 'Won the event';
	if (playoff.finalist) return 'Finalist';
	return playoff.position;
}

export function awardName(name: string): string {
	return name
		.replace(/<[^>]*>/g, '')
		.replace(/®/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}
