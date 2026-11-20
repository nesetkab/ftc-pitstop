import medium from '@fontsource/hanken-grotesk/files/hanken-grotesk-latin-500-normal.woff?inline';
import bold from '@fontsource/hanken-grotesk/files/hanken-grotesk-latin-700-normal.woff?inline';

function decode(dataUrl: string): ArrayBuffer {
	const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export const OG_FONTS = [
	{ name: 'Hanken Grotesk', data: decode(medium), weight: 500 as const, style: 'normal' as const },
	{ name: 'Hanken Grotesk', data: decode(bold), weight: 700 as const, style: 'normal' as const }
];
