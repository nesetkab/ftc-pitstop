import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value?.trim() || undefined;

export const variables = defineEnvVars({
	FTC_USERNAME: {
		schema: optional,
		description: 'FTC Events API username, server only'
	},
	FTC_API_KEY: {
		schema: optional,
		description: 'FTC Events API authorization key, server only'
	},
	NEXUS_API_KEY: {
		schema: optional,
		description: 'Nexus API key for queue status, optional'
	},
	KV_REST_API_URL: {
		schema: optional,
		description: 'Upstash Redis REST URL as set by the Vercel integration, optional'
	},
	KV_REST_API_TOKEN: {
		schema: optional,
		description: 'Upstash Redis REST token as set by the Vercel integration, optional'
	},
	UPSTASH_REDIS_REST_URL: {
		schema: optional,
		description: 'Upstash Redis REST URL, optional'
	},
	UPSTASH_REDIS_REST_TOKEN: {
		schema: optional,
		description: 'Upstash Redis REST token, optional'
	}
});
