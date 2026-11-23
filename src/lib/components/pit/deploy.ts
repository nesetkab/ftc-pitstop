import type { ReplaySettings } from '#lib/game/replay.ts';
import type { QueueCall } from './queue.ts';

export const VERSION_CHECK = 10 * 60_000;

export interface DeployState {
	updated: boolean;
	replay: ReplaySettings | null;
	call: QueueCall | null;
}

export function reloadDue(state: DeployState): boolean {
	return state.updated && state.replay === null && state.call === null;
}

export function watchDeploys(check: () => unknown, every = VERSION_CHECK): () => void {
	const timer = setInterval(() => void check(), every);
	return () => clearInterval(timer);
}
