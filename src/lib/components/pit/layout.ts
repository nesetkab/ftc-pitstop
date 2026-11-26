/** Where a box sits on the TV board, in percent of the board. */
export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export const BOXES = ['stream', 'next', 'standings', 'matches', 'results'] as const;
export type BoxId = (typeof BOXES)[number];
export type Rects = Partial<Record<BoxId, Rect>>;

/** Each screen with boxes saves its own arrangement. */
export const BOARDS = ['quals', 'playoffs', 'stream', 'playoffs-stream'] as const;
export type BoardName = (typeof BOARDS)[number];
export const layoutKey = (board: BoardName) => `pitstop:board:${board}`;

/** Boxes snap to a grid of 12 columns and 12 rows. */
export const SNAP = 100 / 12;
export const MIN_WIDTH = 2 * SNAP;
export const MIN_HEIGHT = 2 * SNAP;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Keeps a box big enough to read and entirely on the screen. */
export function fitRect({ x, y, w, h }: Rect): Rect {
	const width = clamp(w, MIN_WIDTH, 100);
	const height = clamp(h, MIN_HEIGHT, 100);
	return { x: clamp(x, 0, 100 - width), y: clamp(y, 0, 100 - height), w: width, h: height };
}

const nearest = (value: number) => Math.round(value / SNAP) * SNAP;

/** Snaps each side to the grid, so boxes that touch stay lined up. */
export function snapRect({ x, y, w, h }: Rect): Rect {
	const left = nearest(x);
	const top = nearest(y);
	return fitRect({ x: left, y: top, w: nearest(x + w) - left, h: nearest(y + h) - top });
}

export function snapRects(rects: Rects): Rects {
	const snapped: Rects = {};
	for (const id of BOXES) {
		const rect = rects[id];
		if (rect) snapped[id] = snapRect(rect);
	}
	return snapped;
}

export function moveRect(rect: Rect, dx: number, dy: number): Rect {
	return snapRect(fitRect({ ...rect, x: rect.x + dx, y: rect.y + dy }));
}

/** Grows or shrinks from the bottom right corner; the top left corner stays put. */
export function sizeRect(rect: Rect, dw: number, dh: number): Rect {
	return snapRect(
		fitRect({
			...rect,
			w: Math.min(rect.w + dw, 100 - rect.x),
			h: Math.min(rect.h + dh, 100 - rect.y)
		})
	);
}

/** Reads a saved board, ignoring anything broken. */
export function parseRects(text: string | null): Rects | null {
	let saved: Partial<Record<BoxId, Partial<Rect>>> | null;
	try {
		saved = JSON.parse(text ?? 'null');
	} catch {
		return null;
	}
	const rects: Rects = {};
	for (const id of BOXES) {
		const rect = saved?.[id];
		if (rect && [rect.x, rect.y, rect.w, rect.h].every((value) => Number.isFinite(value))) {
			rects[id] = snapRect(rect as Rect);
		}
	}
	return Object.keys(rects).length > 0 ? rects : null;
}
