import type { Config } from '@sveltejs/adapter-vercel';

export const config: Config = { isr: { expiration: 60 } };
