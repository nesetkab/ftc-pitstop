import { initWasm, Resvg } from '@resvg/resvg-wasm';
import wasm from '@resvg/resvg-wasm/index_bg.wasm?inline';
import satori from 'satori';
import { OG_SIZE, type OgNode } from '#lib/server/og/cards.ts';
import { OG_FONTS } from '#lib/server/og/fonts.ts';

let ready: Promise<void> | null = null;

function decode(dataUrl: string): Uint8Array {
	return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

function prepare(): Promise<void> {
	ready ??= initWasm(decode(wasm)).catch((error: unknown) => {
		ready = null;
		throw error;
	});
	return ready;
}

export async function renderPng(node: OgNode): Promise<Uint8Array<ArrayBuffer>> {
	const [svg] = await Promise.all([
		satori(node as Parameters<typeof satori>[0], { ...OG_SIZE, fonts: OG_FONTS }),
		prepare()
	]);
	const png = new Resvg(svg, { fitTo: { mode: 'width', value: OG_SIZE.width } }).render().asPng();
	return new Uint8Array(png);
}
