import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecordRow } from '#lib/components/records/records.ts';
import { load } from './+page.server.ts';

const server = vi.hoisted(() => ({
	loadRecordDataset: vi.fn(),
	recordNames: vi.fn()
}));

vi.mock('#lib/server/records.ts', () => server);

type Result = {
	rows: (RecordRow & { rank: number })[];
	total: number;
	filters: { part: string; page: number };
	names: { teams: Record<number, string> };
};

function call(query = '') {
	const setHeaders = vi.fn();
	const url = new URL(`https://ftcpitstop.com/records${query}`);
	const result = load({ url, setHeaders } as never) as Promise<Result>;
	return { result, setHeaders };
}

function row(total: number, auto: number, teams: number[]): RecordRow {
	return {
		event: 'USAZGIQ',
		day: '2026-11-14',
		type: 'Qualifier',
		region: 'USAZ',
		key: `q${total}`,
		label: `Q${total}`,
		level: 'qual',
		alliance: 'red',
		teams,
		opponents: [9, 10],
		result: 'win',
		total,
		opponent: 50,
		auto,
		teleop: total - auto,
		hive: 0,
		flower: 0,
		garden: 0,
		park: 0,
		tips: 0
	};
}

beforeEach(() => {
	for (const mock of Object.values(server)) mock.mockReset();
	server.recordNames.mockResolvedValue({ teams: { 1: 'One' }, events: {} });
});

describe('records load', () => {
	it('asks for a retry while the season is still loading', async () => {
		server.loadRecordDataset.mockResolvedValue(null);
		await expect(call().result).rejects.toMatchObject({ status: 503 });
	});

	it('sorts by the chosen part and names the teams on the page', async () => {
		server.loadRecordDataset.mockResolvedValue({
			updated: 5,
			dataset: {
				rows: [row(100, 40, [1, 2]), row(150, 10, [3, 4]), row(120, 40, [5, 6])],
				regions: [],
				types: []
			}
		});
		const { result, setHeaders } = call('?part=auto&team=1');
		const data = await result;
		expect(data.total).toBe(1);
		expect(data.rows.map((entry) => entry.total)).toEqual([100]);
		expect(server.recordNames).toHaveBeenCalledWith([1, 2, 1], ['USAZGIQ']);
		expect(setHeaders).toHaveBeenCalledWith({
			'cache-control': 'public, s-maxage=900, stale-while-revalidate=86400'
		});

		const all = await call('?part=auto').result;
		expect(all.rows.map((entry) => [entry.total, entry.rank])).toEqual([
			[120, 1],
			[100, 1],
			[150, 3]
		]);
	});
});
