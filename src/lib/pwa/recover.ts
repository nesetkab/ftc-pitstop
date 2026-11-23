import { CACHE_PREFIX, isStaleWorker } from './rules.ts';

export const RECOVER_DELAY = 15_000;
export const RECOVER_KEY = 'ps-worker-reset';

interface Registration {
	readonly installing: unknown;
	readonly waiting: unknown;
	unregister(): Promise<boolean>;
}

export interface RecoverDeps {
	controlled: boolean;
	registration(): Promise<Registration | undefined>;
	keys(): Promise<string[]>;
	remove(key: string): Promise<boolean>;
	done(): string | null;
	mark(version: string): void;
}

export async function recoverWorker(version: string, deps: RecoverDeps): Promise<boolean> {
	if (!deps.controlled || deps.done() === version) return false;
	const registration = await deps.registration();
	if (!registration) return false;
	const keys = await deps.keys();
	const pending = Boolean(registration.installing || registration.waiting);
	if (!isStaleWorker(keys, version, pending)) return false;
	deps.mark(version);
	await Promise.all(
		keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => deps.remove(key))
	);
	void registration.unregister().catch(() => false);
	return true;
}

function storage(): Pick<RecoverDeps, 'done' | 'mark'> {
	return {
		done: () => {
			try {
				return localStorage.getItem(RECOVER_KEY);
			} catch {
				return null;
			}
		},
		mark: (version) => {
			try {
				localStorage.setItem(RECOVER_KEY, version);
			} catch {
				return;
			}
		}
	};
}

export function scheduleRecovery(version: string, delay = RECOVER_DELAY): () => void {
	const workers = globalThis.navigator?.serviceWorker;
	if (!workers || typeof caches === 'undefined') return () => {};
	const timer = setTimeout(() => {
		void recoverWorker(version, {
			controlled: Boolean(workers.controller),
			registration: () => workers.getRegistration(),
			keys: () => caches.keys(),
			remove: (key) => caches.delete(key),
			...storage()
		}).catch(() => false);
	}, delay);
	return () => clearTimeout(timer);
}
