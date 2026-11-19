import { FTC_API_KEY, FTC_USERNAME } from '$app/env/private';
import { createFtcClient } from './client.ts';

export const ftc = createFtcClient({ username: FTC_USERNAME, apiKey: FTC_API_KEY });

export * from './client.ts';
export * from './endpoints.ts';
export * from './mappers.ts';
export * from './schemas.ts';
