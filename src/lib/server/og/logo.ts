import source from '#lib/ui/Logo.svelte?raw';

export function logoSvg(color: string): string {
	const start = source.indexOf('<svg');
	const end = source.indexOf('</svg>') + '</svg>'.length;
	return source
		.slice(start, end)
		.replace(/\s+(class|role|aria-label)=("[^"]*"|\{[^}]*\})/g, '')
		.replace(/\s+style:height/g, '')
		.replace(/id=\{(\w+)\}/g, 'id="$1"')
		.replace(/#\{(\w+)\}/g, '#$1')
		.replaceAll('currentColor', color);
}

export function logoDataUri(color: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(logoSvg(color)).toString('base64')}`;
}
