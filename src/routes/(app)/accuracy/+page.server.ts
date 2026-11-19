import type { Config } from '@sveltejs/adapter-vercel';
import {
	isAccuracyReport,
	prepareReport,
	type AccuracyReport
} from '#lib/components/team/accuracy.ts';
import sample from '#lib/components/team/accuracy-sample.json';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { PageServerLoad } from './$types';

export const config: Config = { isr: { expiration: false } };

const published = import.meta.glob('/src/lib/model/accuracy.json', {
	eager: true,
	import: 'default'
});

export const load: PageServerLoad = ({
	setHeaders
}): { report: AccuracyReport | null; sample: boolean } => {
	setHeaders({ 'cache-control': CACHE_CONTROL.list });
	const [real] = Object.values(published);
	if (isAccuracyReport(real)) return { report: prepareReport(real), sample: false };
	const fallback: unknown = sample;
	return { report: isAccuracyReport(fallback) ? prepareReport(fallback) : null, sample: true };
};
