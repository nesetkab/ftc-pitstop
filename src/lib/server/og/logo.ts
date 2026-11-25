import source from '../../../../static/logo.svg?raw';

export function logoSvg(color: string): string {
	return source.trim().replaceAll('currentColor', color);
}

export function logoDataUri(color: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(logoSvg(color)).toString('base64')}`;
}
