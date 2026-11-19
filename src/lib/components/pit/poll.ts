export const BUNDLE_INTERVAL = 15_000;
export const QUEUE_INTERVAL = 10_000;
export const MAX_BACKOFF = 120_000;
export const STALE_AFTER = 180_000;

export function retryDelay(base: number, failures: number, max = MAX_BACKOFF): number {
	if (failures <= 0) return base;
	return Math.min(max, base * 2 ** failures);
}

export function isStale(lastSuccess: number | null, now: number, after = STALE_AFTER): boolean {
	return lastSuccess !== null && now - lastSuccess > after;
}

export type Connection = 'connected' | 'retrying' | 'offline';

export function connection(failures: number, online: boolean): Connection {
	if (!online) return 'offline';
	return failures > 0 ? 'retrying' : 'connected';
}
