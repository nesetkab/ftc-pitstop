import { breakdownsOf, type Breakdowns } from '#lib/game/breakdowns.ts';
import { loadEventBundle } from '#lib/server/event.ts';

interface BreakdownEvent {
	params: { code: string };
	parent: () => Promise<{ cacheControl: string }>;
	setHeaders: (headers: Record<string, string>) => void;
}

export async function loadBreakdowns({
	params,
	parent,
	setHeaders
}: BreakdownEvent): Promise<{ breakdowns: Breakdowns }> {
	const [{ cacheControl }, bundle] = await Promise.all([
		parent(),
		loadEventBundle(params.code).catch(() => null)
	]);
	setHeaders({ 'cache-control': cacheControl });
	return { breakdowns: bundle ? breakdownsOf(bundle.matches) : {} };
}
