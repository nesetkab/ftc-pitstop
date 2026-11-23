import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './+page.server.ts';

const server = vi.hoisted(() => ({
	loadSeasonModelWithin: vi.fn(),
	recordNames: vi.fn()
}));

vi.mock('#lib/server/analysis.ts', () => ({
	loadSeasonModelWithin: server.loadSeasonModelWithin
}));
vi.mock('#lib/server/records.ts', () => ({ recordNames: server.recordNames }));

function call(query: string) {
	const setHeaders = vi.fn();
	const url = new URL(`https://ftcpitstop.com/simulate${query}`);
	return {
		result: load({ url, setHeaders } as never) as Promise<Record<string, unknown>>,
		setHeaders
	};
}

beforeEach(() => {
	server.loadSeasonModelWithin.mockReset().mockResolvedValue(null);
	server.recordNames.mockReset().mockResolvedValue({
		teams: { 724: 'Seven', 10662: 'Ten', 5026: 'Five', 4133: 'Four' },
		events: {}
	});
});

describe('simulate load', () => {
	it('sends picker fields and messy links to the share link', async () => {
		await expect(call('?r1=724&r2=10662&b1=5026&b2=').result).rejects.toMatchObject({
			status: 303,
			location: '/simulate?red=724,10662&blue=5026'
		});
		await expect(call('?red=724,724,1&blue=724').result).rejects.toMatchObject({
			location: '/simulate?red=724,1'
		});
	});

	it('loads a canonical link and keeps it short lived while ratings load', async () => {
		const { result, setHeaders } = call('?red=724%2C10662&blue=5026,4133');
		await expect(result).resolves.toMatchObject({
			sides: { red: [724, 10662], blue: [5026, 4133] },
			simulation: null,
			ready: false
		});
		expect(setHeaders).toHaveBeenCalledWith({
			'cache-control': 'public, s-maxage=30, stale-while-revalidate=300'
		});
	});
});
