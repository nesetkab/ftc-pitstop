import { describe, expect, it } from 'vitest';
import { fitRect, moveRect, parseRects, sizeRect, SNAP, snapRect } from './layout.ts';

const box = { x: 6 * SNAP, y: 6 * SNAP, w: 4 * SNAP, h: 4 * SNAP };

describe('board boxes', () => {
	it('snaps both sides to the grid', () => {
		const rect = snapRect({ x: 36.5, y: 0, w: 31.8, h: 48 });
		expect(rect.x).toBeCloseTo(4 * SNAP);
		expect(rect.x + rect.w).toBeCloseTo(8 * SNAP);
		expect(rect.h).toBeCloseTo(6 * SNAP);
	});

	it('stays on the screen when moved', () => {
		const moved = moveRect(box, 90, -90);
		expect(moved.x + moved.w).toBeCloseTo(100);
		expect(moved.y).toBe(0);
	});

	it('resizes within limits without moving the top left corner', () => {
		const sized = sizeRect(box, 90, -90);
		expect(sized.x).toBeCloseTo(box.x);
		expect(sized.w).toBeCloseTo(6 * SNAP);
		expect(sized.h).toBeCloseTo(2 * SNAP);
	});

	it('brings an oversized box back on screen', () => {
		expect(fitRect({ x: -5, y: 0, w: 200, h: 100 })).toEqual({ x: 0, y: 0, w: 100, h: 100 });
	});

	it('ignores broken saved layouts', () => {
		expect(parseRects('nope')).toBeNull();
		expect(parseRects(null)).toBeNull();
		expect(parseRects('{"next":{"x":1}}')).toBeNull();
		expect(parseRects(JSON.stringify({ next: box }))?.next?.w).toBeCloseTo(box.w);
	});
});
