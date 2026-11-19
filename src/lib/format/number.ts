import { MISSING } from './pct.ts';

const MINUS = '−';
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(digits: number, signDisplay: 'negative' | 'exceptZero'): Intl.NumberFormat {
	const key = `${digits}:${signDisplay}`;
	let format = formatters.get(key);
	if (!format) {
		format = new Intl.NumberFormat('en-US', {
			minimumFractionDigits: digits,
			maximumFractionDigits: digits,
			signDisplay
		});
		formatters.set(key, format);
	}
	return format;
}

function isNumber(value: number | null | undefined): value is number {
	return value != null && Number.isFinite(value);
}

export function fixed(value: number | null | undefined, digits = 1): string {
	if (!isNumber(value)) return MISSING;
	return formatter(digits, 'negative').format(value).replace('-', MINUS);
}

export function signed(value: number | null | undefined, digits = 1): string {
	if (!isNumber(value)) return MISSING;
	return formatter(digits, 'exceptZero').format(value).replace('-', MINUS);
}

export function integer(value: number | null | undefined): string {
	return fixed(value, 0);
}
