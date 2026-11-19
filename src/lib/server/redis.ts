import { Redis } from '@upstash/redis';
import {
	KV_REST_API_TOKEN,
	KV_REST_API_URL,
	UPSTASH_REDIS_REST_TOKEN,
	UPSTASH_REDIS_REST_URL
} from '$app/env/private';

export interface RedisLike {
	get(key: string): Promise<unknown>;
	set(key: string, value: string, options: { ex: number }): Promise<unknown>;
}

let client: Redis | null | undefined;

export function redisConfig(): { url: string; token: string } | null {
	const url = UPSTASH_REDIS_REST_URL ?? KV_REST_API_URL;
	const token = UPSTASH_REDIS_REST_TOKEN ?? KV_REST_API_TOKEN;
	return url && token ? { url, token } : null;
}

export function getRedis(): Redis | null {
	if (client === undefined) {
		const config = redisConfig();
		client = config ? new Redis({ ...config, automaticDeserialization: false }) : null;
	}
	return client;
}
