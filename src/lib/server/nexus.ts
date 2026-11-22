import * as z from 'zod';
import { NEXUS_API_KEY } from '$app/env/private';
import { SEASON } from '#lib/game/biobuzz.ts';
import { createBreaker, type Breaker } from '#lib/server/breaker.ts';
import type { QueueMatch, QueueStatus, QueueStatusSnapshot } from '#lib/types.ts';

export const NEXUS_API_ROOT = 'https://ftc.nexus/api/v1/';

export class NexusError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'NexusError';
		this.status = status;
	}
}

const time = z.number().nullish();
const teams = z.array(z.union([z.string(), z.number()]).nullish()).nullish();

const nexusMatch = z.object({
	label: z.string(),
	status: z.string().nullish(),
	redTeams: teams,
	blueTeams: teams,
	times: z
		.object({
			scheduledStartTime: time,
			estimatedQueueTime: time,
			estimatedOnDeckTime: time,
			estimatedOnFieldTime: time,
			estimatedStartTime: time,
			actualQueueTime: time,
			actualOnDeckTime: time,
			actualOnFieldTime: time,
			actualStartTime: time,
			actualCommitTime: time
		})
		.nullish(),
	breakAfter: z.string().nullish(),
	replayOf: z.string().nullish()
});

export const nexusEventStatus = z.object({
	eventKey: z.string(),
	dataAsOfTime: z.number(),
	nowQueuing: z.string().nullish(),
	matches: z.array(nexusMatch).nullish(),
	announcements: z
		.array(z.object({ id: z.string(), announcement: z.string(), postedTime: z.number() }))
		.nullish()
});

export type NexusEventStatus = z.output<typeof nexusEventStatus>;

const STATUS: Record<string, QueueStatus> = {
	'queuing soon': 'queuing-soon',
	'now queuing': 'now-queuing',
	'on deck': 'on-deck',
	'on field': 'on-field'
};

export function mapQueueStatus(raw: string | null | undefined): QueueStatus | null {
	return STATUS[raw?.trim().toLowerCase() ?? ''] ?? null;
}

export function nexusMatchKey(label: string): string | null {
	const match = /^(qualification|playoff|final)s?\s+(\d+)/i.exec(label.trim());
	if (!match) return null;
	const kind = match[1].toLowerCase();
	if (kind === 'qualification') return `q${match[2]}`;
	if (kind === 'playoff') return `p${match[2]}`;
	return null;
}

function teamNumbers(raw: z.output<typeof teams>): number[] {
	return (raw ?? []).flatMap((team) => {
		const number = Number(team);
		return team != null && Number.isInteger(number) && number > 0 ? [number] : [];
	});
}

export function mapNexusMatch(raw: z.output<typeof nexusMatch>): QueueMatch {
	const times = raw.times ?? {};
	return {
		label: raw.label,
		key: nexusMatchKey(raw.label),
		status: mapQueueStatus(raw.status),
		red: teamNumbers(raw.redTeams),
		blue: teamNumbers(raw.blueTeams),
		times: {
			scheduledStart: times.scheduledStartTime ?? null,
			estimatedQueue: times.estimatedQueueTime ?? null,
			estimatedOnDeck: times.estimatedOnDeckTime ?? null,
			estimatedOnField: times.estimatedOnFieldTime ?? null,
			estimatedStart: times.estimatedStartTime ?? null,
			actualQueue: times.actualQueueTime ?? null,
			actualOnDeck: times.actualOnDeckTime ?? null,
			actualOnField: times.actualOnFieldTime ?? null,
			actualStart: times.actualStartTime ?? null,
			actualCommit: times.actualCommitTime ?? null
		},
		breakAfter: raw.breakAfter ?? null,
		replayOf: raw.replayOf ?? null
	};
}

export function mapNexusStatus(raw: NexusEventStatus): QueueStatusSnapshot {
	return {
		eventKey: raw.eventKey,
		dataAsOfTime: raw.dataAsOfTime,
		nowQueuing: raw.nowQueuing ?? null,
		matches: (raw.matches ?? []).map(mapNexusMatch),
		announcements: (raw.announcements ?? []).map((item) => ({
			id: item.id,
			text: item.announcement,
			postedTime: item.postedTime
		}))
	};
}

export function nexusEventKey(code: string, season = SEASON): string {
	return `${season}${code.toLowerCase()}`;
}

export interface NexusClientOptions {
	apiKey?: string;
	fetch?: typeof fetch;
	timeoutMs?: number;
	breaker?: Breaker;
}

function isOutage(status: number): boolean {
	return status === 401 || status === 403 || status === 429 || status >= 500;
}

export function createNexusClient(options: NexusClientOptions = {}) {
	const timeoutMs = options.timeoutMs ?? 3_000;
	const breaker = options.breaker ?? createBreaker({ threshold: 3 });

	async function eventStatus(code: string): Promise<QueueStatusSnapshot | null> {
		if (!options.apiKey) return null;
		if (!breaker.allow()) throw new NexusError(503, 'Nexus is paused after errors');
		try {
			const status = await fetchStatus(code, options.apiKey);
			breaker.success();
			return status;
		} catch (error) {
			if (error instanceof NexusError && isOutage(error.status)) breaker.failure();
			else breaker.success();
			throw error;
		}
	}

	async function fetchStatus(code: string, apiKey: string): Promise<QueueStatusSnapshot | null> {
		let response: Response;
		try {
			response = await (options.fetch ?? fetch)(`${NEXUS_API_ROOT}event/${nexusEventKey(code)}`, {
				headers: { 'Nexus-Api-Key': apiKey, accept: 'application/json' },
				signal: AbortSignal.timeout(timeoutMs)
			});
		} catch (error) {
			if (error instanceof Error && error.name === 'TimeoutError') {
				throw new NexusError(504, 'Nexus timed out');
			}
			throw new NexusError(502, 'Nexus is unreachable');
		}
		if (response.status === 404) {
			await response.body?.cancel();
			return null;
		}
		if (!response.ok) {
			await response.body?.cancel();
			const message =
				response.status === 401 || response.status === 403
					? 'Nexus rejected the API key'
					: `Nexus error ${response.status}`;
			throw new NexusError(response.status, message);
		}
		const raw: unknown = await response.json().catch(() => undefined);
		if (raw === undefined) throw new NexusError(502, 'Nexus sent a response that is not JSON');
		const parsed = nexusEventStatus.safeParse(raw);
		if (!parsed.success) throw new NexusError(502, 'Nexus sent data in an unexpected shape');
		return mapNexusStatus(parsed.data);
	}

	return { configured: Boolean(options.apiKey), eventStatus, breaker };
}

export type NexusClient = ReturnType<typeof createNexusClient>;

export const nexus = createNexusClient({ apiKey: NEXUS_API_KEY });
