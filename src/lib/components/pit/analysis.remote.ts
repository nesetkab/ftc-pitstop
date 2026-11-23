import * as z from 'zod';
import { query } from '$app/server';
import { getAnalysis } from '#lib/components/pit/analysis.server.ts';
import { replayBundle } from '#lib/game/replay.ts';
import { loadEventBundle } from '#lib/server/event.ts';

const MAX_REPLAY_TIME = 4_102_444_800_000;

const request = z.object({
	code: z.string().regex(/^[A-Za-z0-9]{2,24}$/),
	at: z.number().int().min(0).max(MAX_REPLAY_TIME).nullable(),
	version: z.string().max(200)
});

export const pitAnalysis = query(request, async ({ code, at }) => {
	try {
		const bundle = await loadEventBundle(code);
		return await getAnalysis(at === null ? bundle : replayBundle(bundle, at), { replayAt: at });
	} catch {
		return null;
	}
});
