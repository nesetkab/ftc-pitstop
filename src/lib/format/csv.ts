export type CsvCell = string | number | null | undefined;

const FORMULA = /^[=+\-@\t\r]/;
const QUOTE = /[",\r\n]/;

function cell(value: CsvCell): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
	const text = FORMULA.test(value) ? `'${value}` : value;
	return QUOTE.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
	return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function round(value: number | null | undefined, digits = 2): number | null {
	if (value === null || value === undefined || !Number.isFinite(value)) return null;
	const scale = 10 ** digits;
	return Math.round(value * scale) / scale;
}
