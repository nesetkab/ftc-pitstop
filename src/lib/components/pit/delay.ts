const CARRIED_OVER_SECONDS = 4 * 3600;

export function shownDelay(seconds: number | null): seconds is number {
	return seconds !== null && Math.abs(seconds) < CARRIED_OVER_SECONDS;
}

export function delayText(seconds: number | null): string | null {
	if (!shownDelay(seconds)) return null;
	const minutes = Math.round(Math.abs(seconds) / 60);
	if (minutes === 0) return 'The field is on schedule.';
	const unit = minutes === 1 ? 'minute' : 'minutes';
	return `The field is running ${minutes} ${unit} ${seconds > 0 ? 'behind' : 'ahead'}.`;
}

export function shortDelay(seconds: number | null): string | null {
	if (!shownDelay(seconds)) return null;
	const minutes = Math.round(Math.abs(seconds) / 60);
	if (minutes === 0) return 'Field is on schedule.';
	return `Field is ${minutes} min ${seconds > 0 ? 'behind' : 'ahead'}.`;
}
