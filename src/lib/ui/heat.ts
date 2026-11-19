export function heatAlpha(p: number): number {
	const clamped = Math.min(1, Math.max(0, p));
	return 0.03 + clamped * 0.16;
}

export function heatBackground(p: number | null | undefined): string | undefined {
	if (p == null || !Number.isFinite(p)) return undefined;
	return `rgba(var(--heat), ${heatAlpha(p).toFixed(3)})`;
}
