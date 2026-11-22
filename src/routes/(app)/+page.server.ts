import type { EventProgress } from '#lib/components/home/today.ts';
import { buildHomeEvents, todayCompetitions } from '#lib/components/team/home.ts';
import { keepAlive, settleWithin } from '#lib/server/cache.ts';
import { loadEventsToday, loadSeasonEvents } from '#lib/server/event.ts';
import { loadHighlights, loadTodayProgress } from '#lib/server/home.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { recordNames } from '#lib/server/records.ts';
import type { EventSummary } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

const PROGRESS_WAIT_MS = 600;
const LIST_WAIT_MS = 4_000;

async function progressFor(events: EventSummary[] | null): Promise<Record<string, EventProgress>> {
	if (!events) return {};
	let timer: ReturnType<typeof setTimeout> | undefined;
	const late = new Promise<Record<string, EventProgress>>((resolve) => {
		timer = setTimeout(() => resolve({}), PROGRESS_WAIT_MS);
	});
	const task = loadTodayProgress(todayCompetitions(events)).catch(() => ({}));
	keepAlive(task);
	const result = await Promise.race([task, late]);
	clearTimeout(timer);
	return result;
}

async function highlightsWithNames() {
	const highlights = await loadHighlights(1000).catch(() => null);
	if (!highlights) return null;
	const all = [...highlights.highest, ...highlights.closest, ...highlights.upsets];
	const names = await recordNames(
		all.flatMap((item) => [...item.red, ...item.blue]),
		all.map((item) => item.event)
	).catch(() => ({ teams: {}, events: {} }));
	return { ...highlights, names };
}

export const load: PageServerLoad = async ({ setHeaders }) => {
	const todayTask = settleWithin(loadEventsToday(), LIST_WAIT_MS);
	const [today, season, progress, highlights] = await Promise.all([
		todayTask,
		settleWithin(
			loadSeasonEvents().then((list) => list.events),
			LIST_WAIT_MS
		),
		todayTask.then(progressFor),
		highlightsWithNames()
	]);
	setHeaders({ 'cache-control': CACHE_CONTROL.live });
	return { ...buildHomeEvents({ today, season, progress }, Date.now()), highlights };
};
