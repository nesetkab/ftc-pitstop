const PRIVATE_PATHS = ['api/workspace'];

export function isDataRequest(pathname: string, scope: string, mode: string): boolean {
	const path = pathname.startsWith(scope) ? pathname.slice(scope.length) : pathname.slice(1);
	if (PRIVATE_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)))
		return false;
	return path.startsWith('api/') || mode === 'navigate';
}

export function isCacheableResponse(response: { status: number; headers: Headers }): boolean {
	if (response.status !== 200) return false;
	const control = response.headers.get('cache-control') ?? '';
	return !/\b(no-store|private)\b/i.test(control) && !response.headers.has('set-cookie');
}
