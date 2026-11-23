export const FOLLOW_KEY = 'ps-follow';

const CHANGE_EVENT = 'ps-follow-change';

export const follows = $state<{ teams: number[] }>({ teams: [] });

function isTeamNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 999_999;
}

function clean(value: unknown): number[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.filter(isTeamNumber))];
}

export function parseFollows(raw: string | null): number[] {
	if (!raw) return [];
	try {
		return clean(JSON.parse(raw));
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

export function writeFollows(teams: number[]): number[] {
	const list = clean(teams);
	try {
		localStorage.setItem(FOLLOW_KEY, JSON.stringify(list));
	} catch {
		return readFollows();
	}
	window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
	return list;
}

export function watchFollows(callback: (teams: number[]) => void): () => void {
	const update = () => callback(readFollows());
	const onStorage = (event: StorageEvent) => {
		if (event.key === null || event.key === FOLLOW_KEY) update();
	};
	window.addEventListener('storage', onStorage);
	window.addEventListener(CHANGE_EVENT, update);
	update();
	return () => {
		window.removeEventListener('storage', onStorage);
		window.removeEventListener(CHANGE_EVENT, update);
	};
}

export function syncFollows(): () => void {
	return watchFollows((teams) => (follows.teams = teams));
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
