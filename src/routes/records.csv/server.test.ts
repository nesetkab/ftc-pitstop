import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecordRow } from '#lib/components/records/records.ts';
import { GET } from './+server.ts';

const server = vi.hoisted(() => ({
	loadRecordDataset: vi.fn(),
	recordNames: vi.fn()
}));

vi.mock('#lib/server/records.ts', () => server);

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
		tips: 1,
		fouls: 0,
		final: total,
		margin: total - 50
	};
}

function call(query = '') {
	return GET({ url: new URL(`https://ftcpitstop.com/records.csv${query}`) } as never);
}

beforeEach(() => {
	for (const mock of Object.values(server)) mock.mockReset();
	server.recordNames.mockResolvedValue({
		teams: { 1: 'One, Inc', 2: 'Two' },
		events: { USAZGIQ: 'Gilbert Qualifier' }
	});
});

describe('records CSV', () => {
	it('asks for a retry while the season is still loading', async () => {
		server.loadRecordDataset.mockResolvedValue(null);
		const response = await call();
		expect(response.status).toBe(503);
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('follows the filters and sort from the records page', async () => {
		server.loadRecordDataset.mockResolvedValue({
			updated: 1,
			dataset: { rows: [row(100, 10, [1, 2]), row(90, 40, [3, 4]), row(80, 5, [1, 5])] }
		});
		const moved = await call('?part=auto&team=1&page=3');
		expect(moved.status).toBe(308);
		expect(moved.headers.get('location')).toBe('/records.csv?part=auto&team=1');
		const response = await call('?part=auto&team=1');
		expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
		expect(response.headers.get('content-disposition')).toBe(
			'attachment; filename="records-2026-auto.csv"'
		);
		expect(response.headers.get('cache-control')).toContain('s-maxage=900');
		const lines = (await response.text()).trim().split('\r\n');
		expect(lines).toHaveLength(3);
		expect(lines[1]).toBe(
			'1,100,10,90,0,0,0,0,1,1 2,"One, Inc / Two",50,win,USAZGIQ,Gilbert Qualifier,2026-11-14,Q100,qual,red'
		);
		expect(lines[2].startsWith('2,80,5,')).toBe(true);
	});
});
