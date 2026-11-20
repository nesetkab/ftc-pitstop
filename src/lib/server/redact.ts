import {
	FTC_API_KEY,
	FTC_USERNAME,
	KV_REST_API_TOKEN,
	KV_REST_API_URL,
	NEXUS_API_KEY,
	UPSTASH_REDIS_REST_TOKEN,
	UPSTASH_REDIS_REST_URL
} from '$app/env/private';

const MIN_LENGTH = 6;

function secretValues(): string[] {
	const values: (string | undefined)[] = [
		FTC_API_KEY,
		FTC_USERNAME,
		NEXUS_API_KEY,
		KV_REST_API_TOKEN,
		KV_REST_API_URL,
		UPSTASH_REDIS_REST_TOKEN,
		UPSTASH_REDIS_REST_URL
	];
	if (FTC_USERNAME && FTC_API_KEY) {
		values.push(`${FTC_USERNAME}:${FTC_API_KEY}`, btoa(`${FTC_USERNAME}:${FTC_API_KEY}`));
	}
	return values.filter((value): value is string => (value?.length ?? 0) >= MIN_LENGTH);
}

export function redact(text: string): string {
	let result = text;
	for (const secret of secretValues()) result = result.replaceAll(secret, '[redacted]');
	return result;
}
