import { FOLLOW_KEY, watchFollowed, writeFollowed } from '#lib/components/event/follow.ts';

export { FOLLOW_KEY };

export const follows = $state<{ teams: number[] }>({ teams: [] });

function isTeamNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 999_999;
}

export function parseFollows(raw: string | null): number[] {
	if (!raw) return [];
	try {
		const value: unknown = JSON.parse(raw);
		return Array.isArray(value)
			? value.filter((team, index) => isTeamNumber(team) && value.indexOf(team) === index)
			: [];
	} catch {
		return [];
	}
}

export function readFollows(): number[] {
	try {
		return parseFollows(localStorage.getItem(FOLLOW_KEY));
	} catch {
		return [];
	}
}

export function syncFollows(): () => void {
	return watchFollowed(() => (follows.teams = readFollows()));
}

export function toggleFollow(team: number): boolean {
	const current = readFollows();
	const next = current.includes(team)
		? current.filter((number) => number !== team)
		: [...current, team];
	writeFollowed(next);
	follows.teams = next;
	return next.includes(team);
}
