import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventRecordRows } from '#lib/components/event/insights.ts';
import { fixtureBundle } from '#lib/components/event/test-fixtures.ts';
import { load } from './+page.server.ts';
import { GET } from '../insights.csv/+server.ts';

const server = vi.hoisted(() => ({
	loadInsightRows: vi.fn(),
	loadSeasonAverages: vi.fn()
}));

vi.mock('#lib/server/insights.ts', () => ({ loadInsightRows: server.loadInsightRows }));
vi.mock('#lib/server/records.ts', () => ({ loadSeasonAverages: server.loadSeasonAverages }));

const bundle = fixtureBundle('USAZGIQ');
const rows = eventRecordRows(bundle.event, bundle.matches);

type Result = {
	rows: { rank: number; total: number; hive: number; level: string }[];
	total: number;
	averages: { qual: { count: number } | null; playoff: { count: number } | null; season: unknown };
};

function call(query = '') {
	const url = new URL(`https://ftcpitstop.com/events/USAZGIQ/insights${query}`);
	return load({ params: { code: 'USAZGIQ' }, url } as never) as Promise<Result>;
}

beforeEach(() => {
	for (const mock of Object.values(server)) mock.mockReset();
	server.loadInsightRows.mockResolvedValue({
		event: bundle.event,
		rows,
		cacheControl: 'public, s-maxage=86400'
	});
	server.loadSeasonAverages.mockResolvedValue(null);
});

describe('insights load', () => {
	it('returns the top scores and averages for quals and playoffs', async () => {
		const result = await call();
		expect(result.rows).toHaveLength(20);
		expect(result.total).toBe(rows.length);
		expect(result.rows[0]).toMatchObject({ rank: 1, total: 178 });
		expect(result.averages.qual?.count).toBe(rows.filter((row) => row.level === 'qual').length);
		expect(result.averages.playoff?.count).toBe(20);
		expect(result.averages.season).toBeNull();
	});

	it('sorts, filters and shows every score on request', async () => {
		const result = await call('?sort=hive&level=qual&all=1');
		expect(result.rows).toHaveLength(result.total);
		expect(result.rows.every((row) => row.level === 'qual')).toBe(true);
		expect(result.rows[0].hive).toBeGreaterThanOrEqual(result.rows[1].hive);
	});

	it('renders an empty page when the event cannot be loaded', async () => {
		server.loadInsightRows.mockRejectedValue(new Error('down'));
		const result = await call();
		expect(result.rows).toEqual([]);
		expect(result.averages.qual).toBeNull();
	});
});

describe('insights CSV', () => {
	it('downloads every score with the filters in the file name', async () => {
		const url = new URL('https://ftcpitstop.com/events/USAZGIQ/insights.csv?level=playoff');
		const response = await GET({ params: { code: 'USAZGIQ' }, url } as never);
		expect(response.headers.get('content-disposition')).toBe(
			'attachment; filename="USAZGIQ-insights-playoff.csv"'
		);
		expect(response.headers.get('cache-control')).toBe('public, s-maxage=86400');
		const lines = (await response.text()).trim().split('\r\n');
		expect(lines).toHaveLength(21);
		expect(lines[1]).toBe('1,M10,playoff,red,18420 25620,win,178,36,142,130,0,2,10,7,81');
	});
});
