export type QrLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrCode {
	size: number;
	modules: boolean[][];
}

const LEVELS: Record<QrLevel, { index: number; format: number }> = {
	L: { index: 0, format: 1 },
	M: { index: 1, format: 0 },
	Q: { index: 2, format: 3 },
	H: { index: 3, format: 2 }
};

const ECC_PER_BLOCK = [
	[
		-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30,
		30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30
	],
	[
		-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28,
		28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28
	],
	[
		-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30,
		30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30
	],
	[
		-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30,
		30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30
	]
];

const BLOCKS = [
	[
		-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14,
		15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25
	],
	[
		-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23,
		25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49
	],
	[
		-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34,
		34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68
	],
	[
		-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35,
		37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81
	]
];

function rawDataModules(version: number): number {
	let result = (16 * version + 128) * version + 64;
	if (version >= 2) {
		const align = Math.floor(version / 7) + 2;
		result -= (25 * align - 10) * align - 55;
		if (version >= 7) result -= 36;
	}
	return result;
}

function dataCodewords(version: number, level: number): number {
	return (
		Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[level][version] * BLOCKS[level][version]
	);
}

function gfMultiply(x: number, y: number): number {
	let z = 0;
	for (let i = 7; i >= 0; i--) {
		z = (z << 1) ^ ((z >>> 7) * 0x11d);
		z ^= ((y >>> i) & 1) * x;
	}
	return z;
}

function rsDivisor(degree: number): number[] {
	const result: number[] = new Array(degree - 1).fill(0);
	result.push(1);
	let root = 1;
	for (let i = 0; i < degree; i++) {
		for (let j = 0; j < result.length; j++) {
			result[j] = gfMultiply(result[j], root);
			if (j + 1 < result.length) result[j] ^= result[j + 1];
		}
		root = gfMultiply(root, 0x02);
	}
	return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
	const result = divisor.map(() => 0);
	for (const byte of data) {
		const factor = byte ^ (result.shift() ?? 0);
		result.push(0);
		divisor.forEach((coefficient, i) => (result[i] ^= gfMultiply(coefficient, factor)));
	}
	return result;
}

function interleave(data: number[], version: number, level: number): number[] {
	const blockCount = BLOCKS[level][version];
	const eccLength = ECC_PER_BLOCK[level][version];
	const raw = Math.floor(rawDataModules(version) / 8);
	const shortBlocks = blockCount - (raw % blockCount);
	const shortLength = Math.floor(raw / blockCount);
	const divisor = rsDivisor(eccLength);
	const blocks: number[][] = [];
	for (let i = 0, k = 0; i < blockCount; i++) {
		const block = data.slice(k, k + shortLength - eccLength + (i < shortBlocks ? 0 : 1));
		k += block.length;
		const ecc = rsRemainder(block, divisor);
		if (i < shortBlocks) block.push(0);
		blocks.push(block.concat(ecc));
	}
	const result: number[] = [];
	for (let i = 0; i < blocks[0].length; i++) {
		blocks.forEach((block, j) => {
			if (i !== shortLength - eccLength || j >= shortBlocks) result.push(block[i]);
		});
	}
	return result;
}

function bit(value: number, index: number): boolean {
	return ((value >>> index) & 1) !== 0;
}

function encodeData(bytes: Uint8Array, version: number, level: number): number[] {
	const bits: number[] = [];
	const append = (value: number, length: number) => {
		for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
	};
	append(0b0100, 4);
	append(bytes.length, version < 10 ? 8 : 16);
	for (const byte of bytes) append(byte, 8);
	const capacity = dataCodewords(version, level) * 8;
	append(0, Math.min(4, capacity - bits.length));
	append(0, (8 - (bits.length % 8)) % 8);
	for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) append(pad, 8);
	const codewords: number[] = [];
	for (let i = 0; i < bits.length; i += 8) {
		codewords.push(bits.slice(i, i + 8).reduce((byte, value) => (byte << 1) | value, 0));
	}
	return codewords;
}

function alignmentPositions(version: number): number[] {
	if (version === 1) return [];
	const count = Math.floor(version / 7) + 2;
	const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
	const result = [6];
	for (let position = version * 4 + 10; result.length < count; position -= step) {
		result.splice(1, 0, position);
	}
	return result;
}

class Matrix {
	readonly version: number;
	readonly size: number;
	readonly modules: boolean[][];
	readonly reserved: boolean[][];

	constructor(version: number) {
		this.version = version;
		this.size = version * 4 + 17;
		this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
		this.reserved = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
	}

	fixed(x: number, y: number, dark: boolean) {
		this.modules[y][x] = dark;
		this.reserved[y][x] = true;
	}

	drawFunctionPatterns(format: number) {
		const { size } = this;
		for (let i = 0; i < size; i++) {
			this.fixed(6, i, i % 2 === 0);
			this.fixed(i, 6, i % 2 === 0);
		}
		this.drawFinder(3, 3);
		this.drawFinder(size - 4, 3);
		this.drawFinder(3, size - 4);
		const positions = alignmentPositions(this.version);
		const last = positions.length - 1;
		positions.forEach((x, i) => {
			positions.forEach((y, j) => {
				const corner = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
				if (!corner) this.drawAlignment(x, y);
			});
		});
		this.drawFormat(format, 0);
		this.drawVersion();
	}

	drawFinder(cx: number, cy: number) {
		for (let dy = -4; dy <= 4; dy++) {
			for (let dx = -4; dx <= 4; dx++) {
				const distance = Math.max(Math.abs(dx), Math.abs(dy));
				const x = cx + dx;
				const y = cy + dy;
				if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
					this.fixed(x, y, distance !== 2 && distance !== 4);
				}
			}
		}
	}

	drawAlignment(cx: number, cy: number) {
		for (let dy = -2; dy <= 2; dy++) {
			for (let dx = -2; dx <= 2; dx++) {
				this.fixed(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
			}
		}
	}

	drawFormat(format: number, mask: number) {
		const { size } = this;
		const data = (format << 3) | mask;
		let remainder = data;
		for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
		const bits = ((data << 10) | remainder) ^ 0x5412;
		for (let i = 0; i <= 5; i++) this.fixed(8, i, bit(bits, i));
		this.fixed(8, 7, bit(bits, 6));
		this.fixed(8, 8, bit(bits, 7));
		this.fixed(7, 8, bit(bits, 8));
		for (let i = 9; i < 15; i++) this.fixed(14 - i, 8, bit(bits, i));
		for (let i = 0; i < 8; i++) this.fixed(size - 1 - i, 8, bit(bits, i));
		for (let i = 8; i < 15; i++) this.fixed(8, size - 15 + i, bit(bits, i));
		this.fixed(8, size - 8, true);
	}

	drawVersion() {
		if (this.version < 7) return;
		let remainder = this.version;
		for (let i = 0; i < 12; i++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
		const bits = (this.version << 12) | remainder;
		for (let i = 0; i < 18; i++) {
			const a = this.size - 11 + (i % 3);
			const b = Math.floor(i / 3);
			this.fixed(a, b, bit(bits, i));
			this.fixed(b, a, bit(bits, i));
		}
	}

	drawCodewords(codewords: number[]) {
		const { size } = this;
		let i = 0;
		for (let right = size - 1; right >= 1; right -= 2) {
			if (right === 6) right = 5;
			for (let vertical = 0; vertical < size; vertical++) {
				for (let j = 0; j < 2; j++) {
					const x = right - j;
					const upward = ((right + 1) & 2) === 0;
					const y = upward ? size - 1 - vertical : vertical;
					if (!this.reserved[y][x] && i < codewords.length * 8) {
						this.modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
						i++;
					}
				}
			}
		}
	}

	applyMask(mask: number) {
		for (let y = 0; y < this.size; y++) {
			for (let x = 0; x < this.size; x++) {
				if (!this.reserved[y][x] && maskBit(mask, x, y)) this.modules[y][x] = !this.modules[y][x];
			}
		}
	}

	penalty(): number {
		const { size, modules } = this;
		let result = 0;
		const line = (get: (i: number, j: number) => boolean) => {
			for (let i = 0; i < size; i++) {
				let color = false;
				let run = 0;
				const history = [0, 0, 0, 0, 0, 0, 0];
				for (let j = 0; j < size; j++) {
					if (get(i, j) === color) {
						run++;
						if (run === 5) result += 3;
						else if (run > 5) result++;
					} else {
						addHistory(run, history, size);
						if (!color) result += finderPatterns(history) * 40;
						color = get(i, j);
						run = 1;
					}
				}
				if (color) {
					addHistory(run, history, size);
					run = 0;
				}
				addHistory(run + size, history, size);
				result += finderPatterns(history) * 40;
			}
		};
		line((y, x) => modules[y][x]);
		line((x, y) => modules[y][x]);
		let dark = 0;
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const color = modules[y][x];
				if (color) dark++;
				if (
					x < size - 1 &&
					y < size - 1 &&
					color === modules[y][x + 1] &&
					color === modules[y + 1][x] &&
					color === modules[y + 1][x + 1]
				) {
					result += 3;
				}
			}
		}
		const total = size * size;
		result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
		return result;
	}
}

function maskBit(mask: number, x: number, y: number): boolean {
	switch (mask) {
		case 0:
			return (x + y) % 2 === 0;
		case 1:
			return y % 2 === 0;
		case 2:
			return x % 3 === 0;
		case 3:
			return (x + y) % 3 === 0;
		case 4:
			return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
		case 5:
			return ((x * y) % 2) + ((x * y) % 3) === 0;
		case 6:
			return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
		default:
			return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
	}
}

function addHistory(run: number, history: number[], size: number) {
	history.pop();
	history.unshift(history[0] === 0 ? run + size : run);
}

function finderPatterns(history: number[]): number {
	const n = history[1];
	const core =
		n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
	return (
		(core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) +
		(core && history[6] >= n * 4 && history[0] >= n ? 1 : 0)
	);
}

export function encodeQr(text: string, level: QrLevel = 'M'): QrCode {
	const bytes = new TextEncoder().encode(text);
	const { index, format } = LEVELS[level];
	let version = 1;
	while (4 + (version < 10 ? 8 : 16) + bytes.length * 8 > dataCodewords(version, index) * 8) {
		version++;
		if (version > 40) throw new RangeError('Text is too long for a QR code');
	}
	const codewords = interleave(encodeData(bytes, version, index), version, index);
	const matrix = new Matrix(version);
	matrix.drawFunctionPatterns(format);
	matrix.drawCodewords(codewords);
	let best = 0;
	let lowest = Infinity;
	for (let mask = 0; mask < 8; mask++) {
		matrix.applyMask(mask);
		matrix.drawFormat(format, mask);
		const score = matrix.penalty();
		if (score < lowest) {
			lowest = score;
			best = mask;
		}
		matrix.applyMask(mask);
	}
	matrix.applyMask(best);
	matrix.drawFormat(format, best);
	return { size: matrix.size, modules: matrix.modules };
}

export function qrPath(code: QrCode, margin = 4): string {
	let path = '';
	code.modules.forEach((row, y) => {
		row.forEach((dark, x) => {
			if (dark) path += `M${x + margin} ${y + margin}h1v1h-1z`;
		});
	});
	return path;
}
