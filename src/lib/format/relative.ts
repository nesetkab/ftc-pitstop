import { toDate, type DateInput } from './time.ts';

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

export function secondsBetween(from: DateInput, to: DateInput): number {
	return (toDate(to).getTime() - toDate(from).getTime()) / 1000;
}

export function relative(input: DateInput, now: DateInput = Date.now()): string {
	const seconds = Math.round(secondsBetween(now, input));
	if (Math.abs(seconds) < 5) return 'just now';
	if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second');
	const minutes = Math.round(seconds / 60);
	if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
	const hours = Math.round(seconds / 3600);
	if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
	return formatter.format(Math.round(seconds / 86400), 'day');
}
