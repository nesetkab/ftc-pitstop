import { describe, expect, it, vi } from 'vitest';
import {
	createNexusClient,
	mapNexusStatus,
	mapQueueStatus,
	nexusEventKey,
	nexusMatchKey
} from '#lib/server/nexus.ts';

const sample = {
	eventKey: '2026usazgiq',
	dataAsOfTime: 1_794_677_000_000,
	nowQueuing: 'Qualification 24',
	matches: [
		{
			label: 'Qualification 23',
			status: 'On field',
			redTeams: ['26670', '32043'],
			blueTeams: ['26128', '38444'],
			times: { scheduledStartTime: 1, estimatedStartTime: 2, actualOnFieldTime: 3 },
			breakAfter: null,
			replayOf: null
		},
		{
			label: 'Qualification 24',
			status: 'Now queuing',
			redTeams: ['2844', null],
			blueTeams: null,
			times: { estimatedQueueTime: 4, actualQueueTime: 5 },
			breakAfter: 'Lunch'
		},
		{ label: 'Qualification 25', status: 'Queuing soon', redTeams: [], blueTeams: [], times: {} },
		{ label: 'Qualification 26', status: 'On deck', times: {} },
		{ label: 'Qualification 23 Replay', status: 'Something new', replayOf: 'Qualification 23' },
		{ label: 'Playoff 3', status: null },
		{ label: 'Final 1' }
	],
	announcements: [{ id: 'a', announcement: 'Lunch at 12', postedTime: 9 }],
	partsRequests: []
};

describe('Nexus', () => {
	it('uses the season and lowercase code as the event key', () => {
		expect(nexusEventKey('USAZGIQ')).toBe('2026usazgiq');
	});

	it('maps queue statuses', () => {
		expect(mapQueueStatus('Queuing soon')).toBe('queuing-soon');
		expect(mapQueueStatus('Now queuing')).toBe('now-queuing');
		expect(mapQueueStatus('On deck')).toBe('on-deck');
		expect(mapQueueStatus('On field')).toBe('on-field');
		expect(mapQueueStatus('Lunch')).toBeNull();
		expect(mapQueueStatus(null)).toBeNull();
	});

	it('maps labels to match keys', () => {
		expect(nexusMatchKey('Qualification 24')).toBe('q24');
		expect(nexusMatchKey('Qualification 24 Replay')).toBe('q24');
		expect(nexusMatchKey('Playoff 8')).toBe('p8');
		expect(nexusMatchKey('Final 1')).toBeNull();
		expect(nexusMatchKey('Practice 1')).toBeNull();
	});

	it('maps a live event status', () => {
		const status = mapNexusStatus(sample);
		expect(status.nowQueuing).toBe('Qualification 24');
		expect(status.matches[0]).toMatchObject({
			key: 'q23',
			status: 'on-field',
			red: [26670, 32043],
			blue: [26128, 38444],
			times: { scheduledStart: 1, estimatedStart: 2, actualOnField: 3, actualQueue: null }
		});
		expect(status.matches[1]).toMatchObject({
			status: 'now-queuing',
			red: [2844],
			blue: [],
			breakAfter: 'Lunch',
			times: { estimatedQueue: 4, actualQueue: 5 }
		});
		expect(status.matches[4]).toMatchObject({
			key: 'q23',
			status: null,
			replayOf: 'Qualification 23'
		});
		expect(status.announcements).toEqual([{ id: 'a', text: 'Lunch at 12', postedTime: 9 }]);
	});

	it('returns null without a key or when the event is not on Nexus', async () => {
		const fetcher = vi.fn(async () => new Response('not found', { status: 404 }));
		expect(
			await createNexusClient({ fetch: fetcher as unknown as typeof fetch }).eventStatus('USAZGIQ')
		).toBeNull();
		expect(fetcher).not.toHaveBeenCalled();
		const client = createNexusClient({
			apiKey: 'nexus-key',
			fetch: fetcher as unknown as typeof fetch
		});
		expect(await client.eventStatus('USAZGIQ')).toBeNull();
		const init = (fetcher.mock.calls[0] as unknown[])[1] as RequestInit;
		expect(new Headers(init.headers).get('nexus-api-key')).toBe('nexus-key');
	});

	it('fetches and maps the status, and reports bad keys', async () => {
		const ok = createNexusClient({
			apiKey: 'k',
			fetch: (async () => Response.json(sample)) as typeof fetch
		});
		expect((await ok.eventStatus('USAZGIQ'))?.matches).toHaveLength(7);
		const rejected = createNexusClient({
			apiKey: 'k',
			fetch: (async () => new Response('bad key', { status: 403 })) as typeof fetch
		});
		await expect(rejected.eventStatus('USAZGIQ')).rejects.toMatchObject({
			status: 403,
			message: 'Nexus rejected the API key'
		});
	});
});
