import { redact } from '#lib/server/redact.ts';

export class DataError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'DataError';
		this.status = status;
	}
}

export function notFound(message: string): DataError {
	return new DataError(404, message);
}

export function unavailable(message: string): DataError {
	return new DataError(503, message);
}

const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
const MAX_DESCRIPTION = 200;

export function describeError(error: unknown): string {
	if (!(error instanceof Error)) return 'unknown error';
	const message = redact(error.message.split(', command was:')[0])
		.replace(URL_PATTERN, '[url]')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, MAX_DESCRIPTION);
	return `${error.name} ${message}`.trim();
}
