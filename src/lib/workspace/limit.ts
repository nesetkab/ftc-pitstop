export interface LimiterRedis {
	get(key: string): Promise<unknown>;
	incr(key: string): Promise<number>;
	expire(key: string, seconds: number): Promise<unknown>;
}

export interface Limiter {
	allow(name: string, limit: number, windowSeconds: number): Promise<boolean>;
	used(name: string, windowSeconds: number): Promise<number>;
}

export interface LimiterOptions {
	prefix?: string;
	now?: () => number;
}

export function createLimiter(redis: LimiterRedis, options: LimiterOptions = {}): Limiter {
	const prefix = options.prefix ?? 'pitstop:limit:';
	const now = options.now ?? Date.now;
	const bucket = (name: string, windowSeconds: number) =>
		`${prefix}${name}:${Math.floor(now() / (windowSeconds * 1000))}`;

	return {
		async allow(name, limit, windowSeconds) {
			const key = bucket(name, windowSeconds);
			const count = await redis.incr(key);
			if (count === 1) await redis.expire(key, windowSeconds * 2);
			return count <= limit;
		},
		async used(name, windowSeconds) {
			const value = Number(await redis.get(bucket(name, windowSeconds)));
			return Number.isFinite(value) ? value : 0;
		}
	};
}
