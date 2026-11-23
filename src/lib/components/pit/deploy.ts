import type { ReplaySettings } from '#lib/game/replay.ts';
import type { QueueCall } from './queue.ts';

export const VERSION_CHECK = 10 * 60_000;
export const WORKER_WAIT = 8_000;

export interface DeployState {
	updated: boolean;
	replay: ReplaySettings | null;
	call: QueueCall | null;
}

interface WorkerRegistration {
	readonly installing: unknown;
	readonly waiting: unknown;
	update(): Promise<unknown>;
}

export interface Workers {
	getRegistration(): Promise<WorkerRegistration | undefined>;
	addEventListener(type: 'controllerchange', listener: () => void): void;
	removeEventListener(type: 'controllerchange', listener: () => void): void;
}

function serviceWorkers(): Workers | undefined {
	return globalThis.navigator?.serviceWorker;
}

export function reloadDue(state: DeployState): boolean {
	return state.updated && state.replay === null && state.call === null;
}

export function watchDeploys(
	check: () => unknown,
	every = VERSION_CHECK,
	workers = serviceWorkers()
): () => void {
	const recheck = () => void check();
	const timer = setInterval(recheck, every);
	workers?.addEventListener('controllerchange', recheck);
	return () => {
		clearInterval(timer);
		workers?.removeEventListener('controllerchange', recheck);
	};
}

function takeover(workers: Workers, wait: number): Promise<void> {
	return new Promise((resolve) => {
		const done = () => {
			clearTimeout(timer);
			workers.removeEventListener('controllerchange', done);
			resolve();
		};
		const timer = setTimeout(done, wait);
		workers.addEventListener('controllerchange', done);
	});
}

export async function reloadOntoNewBuild(
	reload = () => location.reload(),
	workers = serviceWorkers(),
	wait = WORKER_WAIT
): Promise<void> {
	if (workers) {
		const registration = await workers.getRegistration().catch(() => undefined);
		await registration?.update().catch(() => undefined);
		if (registration?.installing || registration?.waiting) await takeover(workers, wait);
	}
	reload();
}
