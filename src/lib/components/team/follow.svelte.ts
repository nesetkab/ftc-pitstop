export const FOLLOW_KEY = 'ps-follow';

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

function writeFollows(teams: number[]) {
	try {
		localStorage.setItem(FOLLOW_KEY, JSON.stringify(teams));
	} catch {
		return;
	}
}

export function syncFollows(): () => void {
	follows.teams = readFollows();
	const onStorage = (event: StorageEvent) => {
		if (event.key === null || event.key === FOLLOW_KEY) follows.teams = readFollows();
	};
	window.addEventListener('storage', onStorage);
	return () => window.removeEventListener('storage', onStorage);
}

export function toggleFollow(team: number): boolean {
	const current = readFollows();
	const next = current.includes(team)
		? current.filter((number) => number !== team)
		: [...current, team];
	writeFollows(next);
	follows.teams = next;
	return next.includes(team);
}
