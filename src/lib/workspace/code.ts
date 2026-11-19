export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const CODE_LENGTH = 6;

export const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/;

export const TEAM_NUMBER_MAX = 999_999;

export type RandomBytes = (length: number) => Uint8Array;

export function browserRandomBytes(length: number): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(length));
}

export function generateCode(random: RandomBytes = browserRandomBytes): string {
	const limit = 256 - (256 % CODE_ALPHABET.length);
	let code = '';
	while (code.length < CODE_LENGTH) {
		for (const byte of random(CODE_LENGTH * 2)) {
			if (byte >= limit) continue;
			code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
			if (code.length === CODE_LENGTH) break;
		}
	}
	return code;
}

export function isCode(value: string): boolean {
	return CODE_PATTERN.test(value);
}

export function normalizeCode(input: string): string | null {
	const code = input.replace(/[^a-z0-9]/gi, '').toUpperCase();
	return isCode(code) ? code : null;
}

export function formatCode(code: string): string {
	return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export function parseTeamNumber(input: string | number): number | null {
	const text = String(input).trim();
	if (!/^\d{1,6}$/.test(text)) return null;
	const number = Number(text);
	return number >= 1 && number <= TEAM_NUMBER_MAX ? number : null;
}

export function parseEventCode(input: string): string | null {
	const code = input.trim().toUpperCase();
	return /^[A-Z0-9]{2,24}$/.test(code) ? code : null;
}

export function newId(): string {
	const bytes = browserRandomBytes(8);
	return Array.from(bytes, (byte) => (byte % 36).toString(36)).join('');
}
