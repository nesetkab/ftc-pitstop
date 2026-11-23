export interface LimiterRedis {
	get(key: string): Promise<unknown>;
	incr(key: string): Promise<number>;
	expire(key: string, seconds: number): Promise<unknown>;
}

export interface Limiter {
	allow(name: string, limit: number, windowSeconds: number): Promise<boolean>;
	used(name: string, windowSeconds: number): Promise<number>;
	blocked(name: string, windowSeconds: number): boolean;
}

export interface LimiterOptions {
	prefix?: string;
	now?: () => number;
	remembered?: number;
}

export function createLimiter(redis: LimiterRedis, options: LimiterOptions = {}): Limiter {
	const prefix = options.prefix ?? 'pitstop:limit:';
	const now = options.now ?? Date.now;
	const remembered = options.remembered ?? 2_000;
	const refused = new Map<string, number>();
	const bucket = (name: string, windowSeconds: number) =>
		`${prefix}${name}:${Math.floor(now() / (windowSeconds * 1000))}`;

	function refuse(key: string, count: number) {
		refused.delete(key);
		refused.set(key, count);
		if (refused.size > remembered) refused.delete(refused.keys().next().value as string);
	}

	return {
		async allow(name, limit, windowSeconds) {
			const key = bucket(name, windowSeconds);
			if (refused.has(key)) return false;
			const count = await redis.incr(key);
			if (count === 1) await redis.expire(key, windowSeconds * 2);
			if (count > limit) refuse(key, count);
			return count <= limit;
		},
		async used(name, windowSeconds) {
			const key = bucket(name, windowSeconds);
			const known = refused.get(key);
			if (known !== undefined) return known;
			const value = Number(await redis.get(key));
			return Number.isFinite(value) ? value : 0;
		},
		blocked(name, windowSeconds) {
			return refused.has(bucket(name, windowSeconds));
		}
	};
}
