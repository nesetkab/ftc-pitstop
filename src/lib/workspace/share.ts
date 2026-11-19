import {
	sharePayloadSchema,
	type Batteries,
	type Checklist,
	type PickList,
	type Plan,
	type SharePayload,
	type ShareTool
} from '#lib/workspace/schemas.ts';

export const MAX_TOKEN_LENGTH = 100_000;
export const MAX_SHARE_BYTES = 700_000;

export type ShareData = {
	picklist: PickList;
	batteries: Batteries;
	checklist: Checklist;
	board: Plan;
};

export interface ShareContext {
	from: string | null;
	team: number | null;
	now?: number;
}

export function sharePayload<T extends ShareTool>(
	tool: T,
	data: ShareData[T],
	context: ShareContext
): SharePayload {
	return {
		v: 1,
		tool,
		data,
		from: context.from,
		team: context.team,
		at: context.now ?? Date.now()
	} as SharePayload;
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (let start = 0; start < bytes.length; start += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
	}
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
	if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
	try {
		const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
		return Uint8Array.from(binary, (char) => char.charCodeAt(0));
	} catch {
		return null;
	}
}

async function pump(
	bytes: Uint8Array<ArrayBuffer>,
	transform: CompressionStream | DecompressionStream,
	limit: number
): Promise<Uint8Array | null> {
	const writer = transform.writable.getWriter();
	writer.write(bytes).catch(() => undefined);
	writer.close().catch(() => undefined);
	const reader = transform.readable.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > limit) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	const joined = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		joined.set(chunk, offset);
		offset += chunk.length;
	}
	return joined;
}

export async function encodeShare(payload: SharePayload): Promise<string> {
	const json = new TextEncoder().encode(JSON.stringify(payload));
	const plain = `p${toBase64Url(json)}`;
	if (typeof CompressionStream === 'undefined') return plain;
	const packed = await pump(json, new CompressionStream('deflate-raw'), MAX_SHARE_BYTES).catch(
		() => null
	);
	if (!packed) return plain;
	const compact = `z${toBase64Url(packed)}`;
	return compact.length < plain.length ? compact : plain;
}

export async function decodeShare(token: string): Promise<SharePayload | null> {
	const clean = token.trim().replace(/^#/, '');
	if (clean.length < 2 || clean.length > MAX_TOKEN_LENGTH) return null;
	const bytes = fromBase64Url(clean.slice(1));
	if (!bytes) return null;
	let json: Uint8Array | null = null;
	if (clean[0] === 'p') json = bytes;
	if (clean[0] === 'z' && typeof DecompressionStream !== 'undefined') {
		json = await pump(
			new Uint8Array(bytes),
			new DecompressionStream('deflate-raw'),
			MAX_SHARE_BYTES
		).catch(() => null);
	}
	if (!json || json.length > MAX_SHARE_BYTES) return null;
	try {
		const parsed = sharePayloadSchema.safeParse(JSON.parse(new TextDecoder().decode(json)));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function shareUrl(origin: string, tool: ShareTool, token: string): string {
	return `${origin}/w/share/${tool}#${token}`;
}
