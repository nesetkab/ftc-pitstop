import type { Lede } from '#lib/components/event/lede.ts';
import type { HomeEvent, TodayEvent } from './home.ts';
import type { WorldRecord } from './record.ts';

type HomeLedeSource = {
	today: TodayEvent[] | null;
	week: HomeEvent[] | null;
	record: Pick<WorldRecord, 'alliance' | 'redScore' | 'blueScore'> | null;
};

function count(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

export function homeLede({ today, week, record }: HomeLedeSource): Lede | null {
	if (today === null) return null;
	const live = today.filter((row) => row.state === 'live').length;
	const lead =
		live > 0
			? `${count(live, 'event is', 'events are')} running now`
			: today.length > 0
				? `${count(today.length, 'event runs', 'events run')} today`
				: 'No events are running today';
	const facts = [
		week && week.length > 0
			? `${count(week.length, 'event starts', 'events start')} this week`
			: '',
		record
			? `the world record is ${record.alliance === 'red' ? record.redScore : record.blueScore}`
			: ''
	].filter(Boolean);
	if (facts.length === 0) return { lead: `${lead}.` };
	const rest = facts.join(', and ');
	return { lead: `${lead}.`, rest: `${rest[0].toUpperCase()}${rest.slice(1)}.` };
}
