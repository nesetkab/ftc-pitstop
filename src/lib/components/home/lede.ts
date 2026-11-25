import type { Lede } from '#lib/components/event/lede.ts';
import type { HomeEvent, TodayEvent } from './home.ts';

type HomeLedeSource = {
	today: TodayEvent[] | null;
	week: HomeEvent[] | null;
};

function count(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

export function homeLede({ today, week }: HomeLedeSource): Lede | null {
	if (today === null) return null;
	const live = today.filter((row) => row.state === 'live').length;
	const lead =
		live > 0
			? `${count(live, 'event is', 'events are')} running now`
			: today.length > 0
				? `${count(today.length, 'event runs', 'events run')} today`
				: 'No events are running today';
	if (!week || week.length === 0) return { lead: `${lead}.` };
	return {
		lead: `${lead}.`,
		rest: `${count(week.length, 'event starts', 'events start')} this week.`
	};
}
