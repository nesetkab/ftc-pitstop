import { search } from '#lib/format/url.ts';
import { DOC_NAMES, REV_PATTERN, type DocName } from '#lib/workspace/schemas.ts';
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
	if (options.rev) params.set('rev', options.rev);
	if (options.key) params.set('key', options.key);
	return search(params);
}

export function parseLoadOptions(params: URLSearchParams): LoadOptions {
	const known: Versions = {};
	for (const part of (params.get('known') ?? '').split(',')) {
		const [name, version] = part.split('.');
		if (name && isDocName(name) && /^\d{1,16}$/.test(version ?? '')) known[name] = Number(version);
	}
	const docs = [...new Set((params.get('docs') ?? '').split(',').filter(isDocName))];
	const token = (name: string) => {
		const value = params.get(name) ?? '';
		return REV_PATTERN.test(value) ? value : undefined;
	};
	return {
		known: params.has('known') ? known : undefined,
		docs: docs.length > 0 ? docs : undefined,
		rev: token('rev'),
		key: token('key')
	};
}
