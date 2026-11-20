import { isIPv4, isIPv6 } from 'node:net';

const UNKNOWN = 'unknown';

function groupsOf(address: string): number[] {
	const [head, tail] = address.split('::');
	const parts = (text: string | undefined) => (text ? text.split(':') : []);
	const expand = (items: string[]) =>
		items.flatMap((item) => {
			if (!item.includes('.')) return [parseInt(item, 16)];
			const [a, b, c, d] = item.split('.').map(Number);
			return [a * 256 + b, c * 256 + d];
		});
	const first = expand(parts(head));
	const last = expand(parts(tail));
	const gap = tail === undefined ? 0 : 8 - first.length - last.length;
	return [...first, ...Array<number>(gap).fill(0), ...last];
}

export function clientKey(raw: string | null | undefined): string {
	const candidate = raw?.split(',').at(-1)?.trim().split('%')[0] ?? '';
	if (isIPv4(candidate)) return candidate;
	if (!isIPv6(candidate)) return UNKNOWN;
	const groups = groupsOf(candidate.toLowerCase());
	const mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
	if (mapped) return `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
	return `${groups
		.slice(0, 4)
		.map((group) => group.toString(16))
		.join(':')}::/64`;
}
