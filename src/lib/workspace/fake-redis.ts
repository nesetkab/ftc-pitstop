import type { WorkspaceRedis } from '#lib/workspace/redis-store.ts';

interface Entry {
	value: string;
	expiresAt: number | null;
}

export interface FakeRedis extends WorkspaceRedis {
	calls: string[];
	keys(): string[];
	ttl(key: string): number | null;
}

export function createFakeRedis(now: () => number = Date.now): FakeRedis {
	const data = new Map<string, Entry>();

	function live(key: string): Entry | undefined {
		const entry = data.get(key);
		if (!entry) return undefined;
		if (entry.expiresAt !== null && entry.expiresAt <= now()) {
			data.delete(key);
			return undefined;
		}
		return entry;
	}

	return {
		calls: [],
		keys: () => [...data.keys()].filter((key) => live(key)),
		ttl(key) {
			const entry = live(key);
			return entry && entry.expiresAt !== null
				? Math.round((entry.expiresAt - now()) / 1000)
				: null;
		},
		async get(key) {
			this.calls.push('get');
			return live(key)?.value ?? null;
		},
		async mget(...keys) {
			this.calls.push('mget');
			return keys.map((key) => live(key)?.value ?? null);
		},
		async set(key, value, options = {}) {
			this.calls.push('set');
			if (options.nx && live(key)) return null;
			data.set(key, {
				value,
				expiresAt: options.ex ? now() + options.ex * 1000 : null
			});
			return 'OK';
		},
		async incr(key) {
			this.calls.push('incr');
			const entry = live(key);
			const next = Number(entry?.value ?? 0) + 1;
			data.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
			return next;
		},
		async decr(key) {
			this.calls.push('decr');
			const entry = live(key);
			const next = Number(entry?.value ?? 0) - 1;
			data.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
			return next;
		},
		async expire(key, seconds) {
			this.calls.push('expire');
			const entry = live(key);
			if (!entry) return 0;
			entry.expiresAt = now() + seconds * 1000;
			return 1;
		}
	};
}
