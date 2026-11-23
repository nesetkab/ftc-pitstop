import { describeError } from '#lib/server/errors.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { loadBadgeFacts, TEAM_NUMBER, type BadgeDeps, type BadgeFacts } from './load.ts';

export type BadgeOutcome =
	{ kind: 'found'; facts: BadgeFacts } | { kind: 'missing' } | { kind: 'failed' };

export const SVG_TYPE = 'image/svg+xml';

export function svgResponse(svg: string, status: number, cacheControl: string): Response {
	return new Response(svg, {
		status,
		headers: { 'content-type': SVG_TYPE, 'cache-control': cacheControl }
	});
}

export async function serveBadge(
	param: string,
	deps: BadgeDeps,
	render: (outcome: BadgeOutcome) => string,
	now = Date.now()
): Promise<Response> {
	if (!TEAM_NUMBER.test(param)) {
		return svgResponse(render({ kind: 'missing' }), 404, CACHE_CONTROL.missing);
	}
	try {
		const facts = await loadBadgeFacts(deps, Number(param), now);
		if (!facts) return svgResponse(render({ kind: 'missing' }), 404, CACHE_CONTROL.missing);
		const cacheControl = facts.complete ? CACHE_CONTROL.badge : CACHE_CONTROL.short;
		return svgResponse(render({ kind: 'found', facts }), 200, cacheControl);
	} catch (error) {
		console.error(`badge for ${param} failed: ${describeError(error)}`);
		return svgResponse(render({ kind: 'failed' }), 503, CACHE_CONTROL.none);
	}
}
