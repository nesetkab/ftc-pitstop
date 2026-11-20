const MAX_LENGTH = 2048;

export function httpUrl(value: string | null | undefined): string | null {
	const text = value?.trim();
	if (!text || text.length > MAX_LENGTH) return null;
	try {
		const url = new URL(text);
		const web = url.protocol === 'http:' || url.protocol === 'https:';
		return web && !url.username && !url.password ? url.href : null;
	} catch {
		return null;
	}
}
