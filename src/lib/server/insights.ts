import { eventRecordRows } from '#lib/components/event/insights.ts';
import type { RecordRow } from '#lib/components/records/records.ts';
import { loadEventBundle } from '#lib/server/event.ts';
import type { Event } from '#lib/types.ts';

export async function loadInsightRows(
	code: string
): Promise<{ event: Event; rows: RecordRow[]; cacheControl: string }> {
	const { cacheControl, event, matches } = await loadEventBundle(code);
	return { event, rows: eventRecordRows(event, matches), cacheControl };
}
