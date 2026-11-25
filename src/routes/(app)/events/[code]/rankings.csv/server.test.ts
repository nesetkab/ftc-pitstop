import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAnalysis, fixtureBundle } from '#lib/components/event/test-fixtures.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { GET } from './+server.ts';

const server = vi.hoisted(() => ({
	loadEventBundle: vi.fn(),
	loadEventAnalysisEntry: vi.fn()
}));

vi.mock('#lib/server/event.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/server/event.ts')>()),
	loadEventBundle: server.loadEventBundle
}));

vi.mock('#lib/server/analysis.ts', () => ({
	loadEventAnalysisEntry: server.loadEventAnalysisEntry
}));

const bundle = fixtureBundle('USAZGIQ');

async function csv(query = '') {
	const url = new URL(`http://localhost/events/USAZGIQ/rankings.csv${query}`);
	const response = await GET({ params: { code: 'USAZGIQ' }, url } as never);
	return (await response.text()).trim().split('\r\n');
}

beforeEach(() => {
	server.loadEventBundle
		.mockReset()
		.mockResolvedValue({ ...bundle, cacheControl: CACHE_CONTROL.finished });
	server.loadEventAnalysisEntry
		.mockReset()
		.mockResolvedValue({ analysis: fakeAnalysis(bundle), cacheControl: CACHE_CONTROL.finished });
});

describe('rankings csv', () => {
	it('exports the default columns', async () => {
		const [header, first] = await csv();
		expect(header).toBe('Rank,Team,Name,RS,Wins,Losses,Ties,TBP,NP max,Avg tips,aOPR');
		expect(first.startsWith('1,26670,SCA Iron Eagles,4.4,5,0,0,')).toBe(true);
	});

	it('exports the chosen columns in the chosen order', async () => {
		const lines = await csv('?cols=played,npavg,opr-auto,opr-teleop&sort=team');
		expect(lines[0]).toBe('Rank,Team,Name,Played,NP avg,Auto aOPR,Teleop aOPR');
		const teams = lines.slice(1).map((line) => Number(line.split(',')[1]));
		expect(teams).toEqual([...teams].sort((a, b) => a - b));
		expect(lines[1].split(',').slice(-2)).toEqual(['12', expect.any(String)]);
	});

	it('leaves aOPR out when the model has not run', async () => {
		server.loadEventAnalysisEntry.mockRejectedValue(new Error('down'));
		const [header] = await csv('?cols=rs,opr,opr-hive');
		expect(header).toBe('Rank,Team,Name,RS');
	});
});
