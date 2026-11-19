import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const FTC_FIXTURES = fileURLToPath(new URL('../fixtures/ftc/2026/', import.meta.url));
export const SCOUT_FIXTURES = fileURLToPath(new URL('./ftcscout/', import.meta.url));

export const FIXTURE_EVENTS = readdirSync(FTC_FIXTURES).filter((name) =>
	existsSync(`${FTC_FIXTURES}${name}/_meta.json`)
);

export function fixture<T = unknown>(code: string, name: string): T {
	return JSON.parse(readFileSync(`${FTC_FIXTURES}${code}/${name}.json`, 'utf8')) as T;
}

export function scoutFixture<T = unknown>(name: string): T {
	return JSON.parse(readFileSync(`${SCOUT_FIXTURES}${name}.json`, 'utf8')) as T;
}

interface Meta {
	endpoints: Record<string, { path: string; status: number; lastModified: string | null }>;
}

export function fixtureFile(path: string): string | null {
	const url = new URL(path, 'https://ftc-api.firstinspires.org/v2.0/2026/');
	const parts = url.pathname.replace(/^\/v2\.0\/\d+\//, '').split('/');
	const params = url.searchParams;
	const page = Number(params.get('page') ?? 1);
	const suffix = page > 1 ? `-${page}` : '';
	const [resource, code, level] = parts;
	if (resource === 'events' && params.get('eventCode')) return `${params.get('eventCode')}/event`;
	if (resource === 'teams' && params.get('eventCode'))
		return `${params.get('eventCode')}/teams${suffix}`;
	if (resource === 'rankings') return `${code}/rankings`;
	if (resource === 'schedule') return `${code}/schedule-${level}`;
	if (resource === 'matches') return `${code}/matches-${params.get('tournamentLevel') ?? 'qual'}`;
	if (resource === 'scores') return `${code}/scores-${level}`;
	if (resource === 'alliances') return `${code}/alliances`;
	if (resource === 'awards') return `${code}/awards`;
	if (resource === 'advancement') return `${code}/advancement`;
	return null;
}

export interface FixtureFetch {
	fetch: typeof fetch;
	calls: { url: string; headers: Record<string, string> }[];
}

export function fixtureFetch(
	options: { failPaths?: RegExp; latencyMs?: number } = {}
): FixtureFetch {
	const calls: FixtureFetch['calls'] = [];
	const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const headers = Object.fromEntries(new Headers(init?.headers).entries());
		calls.push({ url, headers });
		if (options.latencyMs) await new Promise((resolve) => setTimeout(resolve, options.latencyMs));
		if (options.failPaths?.test(url)) return new Response('upstream broke', { status: 500 });
		const file = fixtureFile(url);
		const [code, name] = file?.split('/') ?? [];
		if (!file || !existsSync(`${FTC_FIXTURES}${file}.json`)) {
			return Response.json(
				`Invalid Event Requested : No event was found using the Season 2026 and Event Code ${code ?? ''}`,
				{ status: 404 }
			);
		}
		const meta = JSON.parse(readFileSync(`${FTC_FIXTURES}${code}/_meta.json`, 'utf8')) as Meta;
		const lastModified = meta.endpoints[name.replace(/-\d+$/, '')]?.lastModified ?? null;
		if (lastModified && headers['if-modified-since'] === lastModified) {
			return new Response(null, { status: 304, headers: { 'last-modified': lastModified } });
		}
		return new Response(readFileSync(`${FTC_FIXTURES}${file}.json`, 'utf8'), {
			status: 200,
			headers: {
				'content-type': 'application/json; charset=utf-8',
				...(lastModified ? { 'last-modified': lastModified } : {})
			}
		});
	};
	return { fetch: fetcher as typeof fetch, calls };
}

export function scoutFetch(responses: Record<string, string | object>): FixtureFetch & {
	bodies: { operationName?: string; query?: string; variables?: Record<string, unknown> }[];
} {
	const calls: FixtureFetch['calls'] = [];
	const bodies: { operationName?: string; query?: string; variables?: Record<string, unknown> }[] =
		[];
	const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({
			url: String(input),
			headers: Object.fromEntries(new Headers(init?.headers).entries())
		});
		const body = JSON.parse(String(init?.body ?? '{}')) as (typeof bodies)[number];
		bodies.push(body);
		const source = responses[body.operationName ?? ''];
		if (!source) return new Response('no fixture', { status: 500 });
		const text =
			typeof source === 'string'
				? readFileSync(`${SCOUT_FIXTURES}${source}.json`, 'utf8')
				: JSON.stringify(source);
		return new Response(text, { status: 200, headers: { 'content-type': 'application/json' } });
	};
	return { fetch: fetcher as typeof fetch, calls, bodies };
}

export const instant = (iso: string) => Date.parse(iso);
