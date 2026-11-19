export const MISSING = '—';

export function pct(p: number | null | undefined): string {
	if (p == null || !Number.isFinite(p)) return MISSING;
	if (p < 0.005) return '<1%';
	if (p >= 0.995) return '>99%';
	return `${Math.round(p * 100)}%`;
}
