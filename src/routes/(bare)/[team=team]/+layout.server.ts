import { error } from '@sveltejs/kit';
import { getAnalysis } from '#lib/components/pit/analysis.server.ts';
import { pickEvent, type EventPickReason } from '#lib/components/pit/resolve.ts';
import { replayBundle, replaySettings } from '#lib/game/replay.ts';
import { DataError } from '#lib/server/errors.ts';
import {
	loadEventBundle,
	loadQueueStatus,
	loadTeamSeason,
	normalizeEventCode
} from '#lib/server/event.ts';
import type { EventBundle } from '#lib/types.ts';
import type { LayoutServerLoad } from './$types';

function eventCode(input: string): string {
	try {
		return normalizeEventCode(input);
	} catch {
		error(404, 'Event not found');
	}
}

async function eventBundle(code: string): Promise<EventBundle | null> {
	try {
		return await loadEventBundle(code);
	} catch (failure) {
		if (failure instanceof DataError && failure.status === 404) error(404, 'Event not found');
		return null;
	}
}

async function queueStatus(code: string) {
	try {
		const queue = await loadQueueStatus(code);
		return { queue, nexus: queue !== null };
	} catch {
		return { queue: null, nexus: true };
	}
}

export const load: LayoutServerLoad = async ({ params, url }) => {
	const team = params.team;
	const requested = url.searchParams.get('event');
	let teamName: string | null = null;
	let reason: EventPickReason | 'chosen' = 'chosen';
	let code: string;

	if (requested) {
		code = eventCode(requested);
	} else {
		let season;
		try {
			season = await loadTeamSeason(team);
		} catch {
			return {
				state: 'unavailable' as const,
				team,
				teamName,
				message: 'Team data is unavailable right now.'
			};
		}
		if (!season) error(404, `Team ${team} not found`);
		teamName = season.team.name;
		const pick = pickEvent(
			season.events.map((entry) => entry.event),
			Date.now()
		);
		if (!pick) return { state: 'no-events' as const, team, teamName };
		code = pick.event.code;
		reason = pick.reason;
	}

	const bundle = await eventBundle(code);
	const replay = bundle ? replaySettings(url.searchParams, bundle) : null;
	const [analysis, status] = await Promise.all([
		bundle
			? getAnalysis(replay ? replayBundle(bundle, replay.start) : bundle, {
					replayAt: replay?.start ?? null
				})
			: null,
		replay ? { queue: null, nexus: false } : queueStatus(code)
	]);
	teamName ??= bundle?.teams.find((entry) => entry.number === team)?.name ?? null;

	return {
		state: 'ready' as const,
		team,
		teamName,
		code,
		reason,
		bundle,
		analysis,
		queue: status.queue,
		nexus: status.nexus,
		replay
	};
};
