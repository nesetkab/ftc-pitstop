import { matchTitle, parseMatchDescription } from '#lib/format/match.ts';
import type { AllianceColor, Match } from '#lib/types.ts';

export function teamNumbers(match: Match, color: AllianceColor): number[] {
	return match[color].map((team) => team.team);
}

export function quals(matches: Match[]): Match[] {
	return matches.filter((match) => match.level === 'qual');
}

export function isFinalsOnly(match: Match): boolean {
	return match.level === 'playoff' && match.label.startsWith('F');
}

export function titleOf(match: Match): string {
	if (match.level === 'qual') return `Qualification ${match.number}`;
	if (isFinalsOnly(match)) return `Finals match ${match.number}`;
	const parsed = parseMatchDescription(match.description);
	if (parsed && parsed.level === 'playoff') {
		return matchTitle({ ...parsed, game: match.number > 1 ? match.number : undefined });
	}
	return match.description || match.label;
}

export function matchHref(code: string, match: Pick<Match, 'key'>): string {
	return `/events/${code}/matches/${match.key}`;
}

export function teamHref(team: number, eventCode?: string | null): string {
	return eventCode ? `/events/${eventCode}/teams/${team}` : `/teams/${team}`;
}

export function isMatchKey(key: string): boolean {
	return /^[qp]\d{1,3}(-\d{1,3})?$/.test(key);
}

export function hasTeam(match: Match, team: number): boolean {
	return (
		match.red.some((entry) => entry.team === team) ||
		match.blue.some((entry) => entry.team === team)
	);
}

export function sideOf(match: Match, team: number): AllianceColor | null {
	if (match.red.some((entry) => entry.team === team)) return 'red';
	if (match.blue.some((entry) => entry.team === team)) return 'blue';
	return null;
}

export function opposite(color: AllianceColor): AllianceColor {
	return color === 'red' ? 'blue' : 'red';
}

export function scheduleTimes(matches: Match[]) {
	return matches.map((match) => ({
		key: match.key,
		scheduled: match.scheduledTime,
		actual: match.actualTime ?? (match.result ? (match.postedTime ?? match.scheduledTime) : null)
	}));
}

export function neighbors(matches: Match[], key: string) {
	const index = matches.findIndex((match) => match.key === key);
	return {
		previous: index > 0 ? matches[index - 1] : null,
		next: index >= 0 && index < matches.length - 1 ? matches[index + 1] : null
	};
}
