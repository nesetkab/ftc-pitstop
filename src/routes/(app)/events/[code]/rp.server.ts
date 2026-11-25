import { localRankings, rpCounts, type RpCounts } from '#lib/components/event/standings.ts';
import { loadEventBundle } from '#lib/server/event.ts';

interface RpEvent {
	params: { code: string };
	parent: () => Promise<unknown>;
}

export async function loadRpCounts({
	params,
	parent
}: RpEvent): Promise<{ rp: Record<number, RpCounts> | null }> {
	const [, bundle] = await Promise.all([parent(), loadEventBundle(params.code).catch(() => null)]);
	if (!bundle || !localRankings(bundle.matches, bundle.rankings)) return { rp: null };
	return { rp: rpCounts(bundle.matches) };
}
