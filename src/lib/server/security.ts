export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'permissions-policy':
		'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()',
	'cross-origin-opener-policy': 'same-origin',
	'x-frame-options': 'DENY'
};

export const DATA_CSP = "default-src 'none'; frame-ancestors 'none'";

function isHtml(response: Response): boolean {
	return response.headers.get('content-type')?.toLowerCase().startsWith('text/html') ?? false;
}

function apply(response: Response, headers: Headers): Response {
	try {
		for (const [name, value] of headers) response.headers.set(name, value);
		return response;
	} catch {
		const merged = new Headers(response.headers);
		for (const [name, value] of headers) merged.set(name, value);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: merged
		});
	}
}

export function withSecurityHeaders(response: Response): Response {
	const headers = new Headers(SECURITY_HEADERS);
	if (!isHtml(response) && !response.headers.has('content-security-policy')) {
		headers.set('content-security-policy', DATA_CSP);
	}
	return apply(response, headers);
}
