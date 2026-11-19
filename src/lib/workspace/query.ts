import { DOC_NAMES, type DocName } from '#lib/workspace/schemas.ts';
import type { LoadOptions, Versions } from '#lib/workspace/types.ts';

function isDocName(value: string): value is DocName {
	return (DOC_NAMES as readonly string[]).includes(value);
}

export function encodeLoadOptions(options: LoadOptions): string {
	const params = new URLSearchParams();
	const known = Object.entries(options.known ?? {})
		.map(([name, version]) => `${name}.${version}`)
		.join(',');
	if (known) params.set('known', known);
	if (options.docs) params.set('docs', options.docs.join(','));
	const query = params.toString();
	return query ? `?${query}` : '';
}

export function parseLoadOptions(params: URLSearchParams): LoadOptions {
	const known: Versions = {};
	for (const part of (params.get('known') ?? '').split(',')) {
		const [name, version] = part.split('.');
		if (name && isDocName(name) && /^\d{1,16}$/.test(version ?? '')) known[name] = Number(version);
	}
	const docs = (params.get('docs') ?? '').split(',').filter(isDocName);
	return {
		known: params.has('known') ? known : undefined,
		docs: docs.length > 0 ? docs : undefined
	};
}
