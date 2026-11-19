export const FOLLOW_KEY = 'ps-follow';

const CHANGE_EVENT = 'ps-follow-change';

function clean(value: unknown): number[] {
	if (!Array.isArray(value)) return [];
	const teams = value.filter((team): team is number => Number.isInteger(team) && team > 0);
	return [...new Set(teams)];
}

export function readFollowed(): number[] {
	try {
		const raw = localStorage.getItem(FOLLOW_KEY);
		return raw ? clean(JSON.parse(raw)) : [];
	} catch {
		return [];
	}
}

export function writeFollowed(teams: number[]): number[] {
	const list = clean(teams);
	try {
		localStorage.setItem(FOLLOW_KEY, JSON.stringify(list));
	} catch {
		return readFollowed();
	}
	window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
	return list;
}

export function isFollowed(team: number): boolean {
	return readFollowed().includes(team);
}

export function toggleFollowed(team: number): number[] {
	const list = readFollowed();
	return writeFollowed(
		list.includes(team) ? list.filter((other) => other !== team) : [...list, team]
	);
}

export function watchFollowed(callback: (teams: number[]) => void): () => void {
	const update = () => callback(readFollowed());
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
