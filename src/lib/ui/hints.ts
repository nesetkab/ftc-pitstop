export const HINTS_KEY = 'ps-hints';
export const INTRO_HINT = 'intro';

export const PIT_HINT = 'pit';

export type HintId = typeof INTRO_HINT | typeof PIT_HINT;

const HINT_IDS = new Set<string>([INTRO_HINT, PIT_HINT]);

export function parseHints(raw: string | null): HintId[] {
	if (!raw) return [];
	try {
		const value: unknown = JSON.parse(raw);
		if (!Array.isArray(value)) return [];
		return [...new Set(value.filter((id): id is HintId => HINT_IDS.has(id)))];
	} catch {
		return [];
	}
}

export function readHints(): HintId[] {
	try {
		return parseHints(localStorage.getItem(HINTS_KEY));
	} catch {
		return [];
	}
}

export function dismissHint(id: HintId): HintId[] {
	const next = [...new Set([...readHints(), id])];
	try {
		localStorage.setItem(HINTS_KEY, JSON.stringify(next));
	} catch {
		return next;
	}
	return next;
}

export function showIntro(dismissed: readonly HintId[], followed: readonly number[]): boolean {
	return followed.length === 0 && !dismissed.includes(INTRO_HINT);
}

export function isoDay(time: number, offsetDays = 0): string {
	return new Date(time + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export function eventThisWeek<T extends { start: string; end: string; live: boolean }>(
	rows: readonly T[],
	now: number
): T | null {
	const today = isoDay(now, -1);
	const horizon = isoDay(now, 7);
	return rows.find((row) => row.live || (row.end >= today && row.start <= horizon)) ?? null;
}
