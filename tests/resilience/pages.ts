import { isHttpError, isRedirect } from '@sveltejs/kit';

export const CODE = 'USAZGIQ';
export const TEAM = 2844;

export interface Outcome {
	page: string;
	status: number;
	ms: number;
	data: unknown;
	cacheControl: string | null;
	message: string | null;
}

type Load = (event: never) => unknown;

interface PageModules {
	home: Load;
	events: Load;
	eventLayout: Load;
	eventPage: Load;
	rankings: Load;
	teamsTab: Load;
	results: Load;
	insights: Load;
	allianceSelection: Load;
	team: Load;
	leaderboards: Load;
	records: Load;
	pit: Load;
	lite: (event: never) => Promise<Response>;
}

export async function importPages(): Promise<PageModules> {
	const [
		home,
		events,
		eventLayout,
		eventPage,
		rankings,
		teamsTab,
		results,
		insights,
		allianceSelection,
		team,
		leaderboards,
		records,
		pit,
		lite
	] = await Promise.all([
		import('../../src/routes/(app)/+page.server.ts'),
		import('../../src/routes/(app)/events/+page.server.ts'),
		import('../../src/routes/(app)/events/[code]/+layout.server.ts'),
		import('../../src/routes/(app)/events/[code]/+page.server.ts'),
		import('../../src/routes/(app)/events/[code]/rankings/+page.server.ts'),
		import('../../src/routes/(app)/events/[code]/teams/+page.server.ts'),
		import('../../src/routes/(app)/events/[code]/results/+page.server.ts'),
		import('../../src/routes/(app)/events/[code]/insights/+page.server.ts'),
		import('../../src/routes/(app)/events/[code]/alliance-selection/+page.server.ts'),
		import('../../src/routes/(app)/teams/[number]/+page.server.ts'),
		import('../../src/routes/(app)/leaderboards/+page.server.ts'),
		import('../../src/routes/(app)/records/+page.server.ts'),
		import('../../src/routes/(bare)/[team=team]/+layout.server.ts'),
		import('../../src/routes/api/events/[code]/lite/+server.ts')
	]);
	return {
		home: home.load,
		events: events.load,
		eventLayout: eventLayout.load,
		eventPage: eventPage.load,
		rankings: rankings.load,
		teamsTab: teamsTab.load,
		results: results.load,
		insights: insights.load,
		allianceSelection: allianceSelection.load,
		team: team.load,
		leaderboards: leaderboards.load,
		records: records.load,
		pit: pit.load,
		lite: lite.GET
	};
}

function kitEvent(
	path: string,
	routeId: string,
	params: Record<string, unknown>,
	headers: Record<string, string>,
	parent: () => Promise<unknown>
) {
	const url = new URL(`http://localhost${path}`);
	return {
		params,
		url,
		route: { id: routeId },
		request: new Request(url),
		setHeaders: (next: Record<string, string>) => {
			for (const [key, value] of Object.entries(next)) headers[key.toLowerCase()] = value;
		},
		depends: () => {},
		untrack: <T>(fn: () => T) => fn(),
		parent,
		getClientAddress: () => '127.0.0.1'
	} as never;
}

async function measure(page: string, run: (headers: Record<string, string>) => Promise<unknown>) {
	const headers: Record<string, string> = {};
	const started = performance.now();
	const finish = (status: number, data: unknown, message: string | null): Outcome => ({
		page,
		status,
		ms: performance.now() - started,
		data,
		cacheControl: headers['cache-control'] ?? null,
		message
	});
	try {
		const result = await run(headers);
		if (result instanceof Response) {
			headers['cache-control'] = result.headers.get('cache-control') ?? '';
			return finish(result.status, await result.json(), null);
		}
		return finish(200, result, null);
	} catch (error) {
		if (isHttpError(error)) return finish(error.status, null, error.body.message);
		if (isRedirect(error)) return finish(error.status, null, error.location);
		return finish(500, null, error instanceof Error ? error.message : String(error));
	}
}

export function visitAll(pages: PageModules): Promise<Outcome[]> {
	const event = (path: string, routeId: string, load: Load) =>
		measure(path, async (headers) => {
			const layoutEvent = kitEvent(path, routeId, { code: CODE }, headers, async () => ({}));
			const parent = () => Promise.resolve(pages.eventLayout(layoutEvent));
			return load(kitEvent(path, routeId, { code: CODE }, headers, parent));
		});
	const plain = (path: string, routeId: string, load: Load, params: Record<string, unknown> = {}) =>
		measure(path, async (headers) =>
			load(kitEvent(path, routeId, params, headers, async () => ({})))
		);
	return Promise.all([
		plain('/', '/(app)', pages.home),
		plain('/events', '/(app)/events', pages.events),
		plain(`/events/${CODE}#layout`, '/(app)/events/[code]', pages.eventLayout, { code: CODE }),
		event(`/events/${CODE}`, '/(app)/events/[code]', pages.eventPage),
		event(`/events/${CODE}/rankings`, '/(app)/events/[code]/rankings', pages.rankings),
		event(`/events/${CODE}/teams`, '/(app)/events/[code]/teams', pages.teamsTab),
		event(`/events/${CODE}/results`, '/(app)/events/[code]/results', pages.results),
		event(`/events/${CODE}/insights`, '/(app)/events/[code]/insights', pages.insights),
		event(
			`/events/${CODE}/alliance-selection`,
			'/(app)/events/[code]/alliance-selection',
			pages.allianceSelection
		),
		plain(`/teams/${TEAM}`, '/(app)/teams/[number]', pages.team, { number: String(TEAM) }),
		plain('/leaderboards', '/(app)/leaderboards', pages.leaderboards),
		plain('/records', '/(app)/records', pages.records),
		plain(`/${TEAM}`, '/(bare)/[team=team]', pages.pit, { team: TEAM }),
		plain(`/${TEAM}/tv?event=${CODE}`, '/(bare)/[team=team]/tv', pages.pit, { team: TEAM }),
		measure(`/api/events/${CODE}/lite`, () =>
			pages.lite({ params: { code: CODE }, url: new URL('http://localhost') } as never)
		)
	]);
}

export function find(outcomes: Outcome[], page: string): Outcome {
	const found = outcomes.find((outcome) => outcome.page === page);
	if (!found) throw new Error(`no outcome for ${page}`);
	return found;
}
