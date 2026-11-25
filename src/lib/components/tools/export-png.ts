const NAMESPACE = 'http://www.w3.org/2000/svg';

const PROPERTIES = [
	'fill',
	'fill-opacity',
	'stroke',
	'stroke-width',
	'stroke-opacity',
	'stroke-dasharray',
	'stroke-linecap',
	'stroke-linejoin',
	'opacity',
	'display',
	'font-size',
	'font-weight',
	'text-anchor',
	'paint-order'
] as const;

function inlineStyles(source: Element, target: Element) {
	const computed = getComputedStyle(source);
	const style = (target as SVGElement).style;
	for (const property of PROPERTIES)
		style.setProperty(property, computed.getPropertyValue(property));
	style.setProperty('font-family', 'Helvetica, Arial, sans-serif');
	for (let index = 0; index < source.children.length; index++) {
		inlineStyles(source.children[index], target.children[index]);
	}
}

function dataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(new Error('The field could not be loaded'));
		reader.readAsDataURL(blob);
	});
}

async function embedImages(copy: SVGSVGElement) {
	const images = Array.from(copy.querySelectorAll('image'));
	await Promise.all(
		images.map(async (image) => {
			if (image.style.getPropertyValue('display') === 'none') {
				image.remove();
				return;
			}
			const href = image.getAttribute('href');
			if (!href || href.startsWith('data:')) return;
			const response = await fetch(href);
			if (!response.ok) throw new Error('The field could not be loaded');
			image.setAttribute('href', await dataUrl(await response.blob()));
		})
	);
}

function slug(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'plan'
	);
}

export function planFilename(name: string): string {
	return `${slug(name)}.png`;
}

export async function renderPng(svg: SVGSVGElement, background: string, size = 960): Promise<Blob> {
	const copy = svg.cloneNode(true) as SVGSVGElement;
	inlineStyles(svg, copy);
	await embedImages(copy);
	copy.setAttribute('xmlns', NAMESPACE);
	copy.setAttribute('width', String(size));
	copy.setAttribute('height', String(size));
	const fill = document.createElementNS(NAMESPACE, 'rect');
	fill.setAttribute('width', '100%');
	fill.setAttribute('height', '100%');
	fill.setAttribute('fill', background);
	copy.insertBefore(fill, copy.firstChild);
	const xml = new XMLSerializer().serializeToString(copy);
	const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
	try {
		const image = new Image();
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error('The plan could not be drawn'));
			image.src = url;
		});
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('The plan could not be drawn');
		context.drawImage(image, 0, 0, size, size);
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
		if (!blob) throw new Error('The plan could not be saved as an image');
		return blob;
	} finally {
		URL.revokeObjectURL(url);
	}
}

export async function exportPng(svg: SVGSVGElement, name: string): Promise<void> {
	const stage = svg.parentElement ?? svg;
	const background = getComputedStyle(stage).backgroundColor;
	const blob = await renderPng(svg, background);
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = planFilename(name);
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
