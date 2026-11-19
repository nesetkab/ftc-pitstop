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
