import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autoScroll } from './auto-scroll.ts';

const FRAME = 1000 / 60;

describe('autoScroll', () => {
	let queue: Array<(now: number) => void> = [];
	let now = 0;

	beforeEach(() => {
		queue = [];
		now = 0;
		vi.stubGlobal('getComputedStyle', () => ({ fontSize: '20px' }));
		vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) =>
			queue.push(callback)
		);
		vi.stubGlobal('cancelAnimationFrame', () => (queue = []));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	/** Runs the screen frames that fall in the next `ms` milliseconds. */
	function run(ms: number, frame = FRAME) {
		const end = now + ms;
		while (now < end) {
			now += frame;
			const due = queue;
			queue = [];
			for (const callback of due) callback(now);
		}
	}

	/** A box holding one list, or two when it has been asked to loop. */
	function setup(height: number, copies = 2) {
		const lists = Array.from({ length: copies }, (_, index) => ({
			style: { transform: '', willChange: '' },
			getBoundingClientRect: () => ({ height, top: index * height })
		}));
		const box = Object.assign(new EventTarget(), {
			children: lists,
			clientHeight: 100,
			scrollTop: 0
		});
		const onloop = vi.fn();
		const stop = autoScroll(onloop)(box as unknown as HTMLElement);
		const y = () => {
			const match = /translate3d\(0, (-?[\d.e-]+)px, 0\)/.exec(lists[0].style.transform);
			return match ? -Number(match[1]) : 0;
		};
		return { box, lists, onloop, stop, y };
	}

	it('moves a little on every frame, not in steps', () => {
		const { y, stop } = setup(120);
		run(1000);
		const seen: number[] = [];
		for (let frame = 0; frame < 20; frame++) {
			run(FRAME);
			seen.push(y());
		}
		const moves = seen.slice(1).map((value, index) => value - seen[index]);
		// 1.2 lines a second at 20px a line is 24px a second, so 0.4px a frame, every frame.
		for (const move of moves) expect(move).toBeCloseTo((24 * FRAME) / 1000, 5);
		stop();
	});

	it('moves at the same speed however often the screen refreshes', () => {
		const slow = setup(120);
		run(2000, 1000 / 30);
		const slowed = slow.y();
		slow.stop();
		queue = [];
		now = 0;
		const fast = setup(120);
		run(2000, 1000 / 120);
		expect(fast.y()).toBeCloseTo(slowed, 0);
		fast.stop();
	});

	it('goes round without stopping, and the copies move together', () => {
		const { y, lists, stop } = setup(120);
		let wrapped = false;
		let before = 0;
		for (let frame = 0; frame < 60 * 12; frame++) {
			run(FRAME);
			if (y() < before) wrapped = true;
			before = y();
			expect(y()).toBeLessThan(120);
			expect(lists[1].style.transform).toBe(lists[0].style.transform);
		}
		expect(wrapped).toBe(true);
		stop();
	});

	it('asks for the second copy once the content is too tall, and measures again at once', () => {
		const { onloop, stop } = setup(120, 1);
		run(FRAME * 2);
		expect(onloop).toHaveBeenCalledWith(true);
		stop();
	});

	it('hands over to the scroll bar under the pointer and carries on from there', () => {
		const { box, y, lists, stop } = setup(120);
		run(3000);
		const before = y();
		expect(before).toBeGreaterThan(0);
		box.dispatchEvent(new Event('pointerenter'));
		expect(lists[0].style.transform).toBe('');
		expect(box.scrollTop).toBeCloseTo(before, 5);
		run(3000);
		expect(lists[0].style.transform).toBe('');
		box.scrollTop = 40;
		box.dispatchEvent(new Event('pointerleave'));
		expect(box.scrollTop).toBe(0);
		expect(y()).toBeCloseTo(40, 5);
		run(1000);
		expect(y()).toBeGreaterThan(40);
		stop();
	});

	it('does not jump after a stalled frame', () => {
		const { y, stop } = setup(120);
		run(1000);
		const before = y();
		now += 60_000;
		run(FRAME);
		expect(y() - before).toBeLessThan(3);
		stop();
	});

	it('leaves a box that fits alone', () => {
		const { y, lists, onloop, stop } = setup(80, 1);
		run(3000);
		expect(y()).toBe(0);
		expect(lists[0].style.transform).toBe('');
		expect(onloop).not.toHaveBeenCalledWith(true);
		stop();
	});

	it('stops looping when the content shrinks to fit', () => {
		const { lists, onloop, y, stop } = setup(120);
		run(2000);
		expect(y()).toBeGreaterThan(0);
		for (const [index, list] of lists.entries()) {
			list.getBoundingClientRect = () => ({ height: 80, top: index * 80 });
		}
		run(1000);
		expect(onloop).toHaveBeenLastCalledWith(false);
		expect(lists[0].style.transform).toBe('');
		stop();
	});

	it('puts everything back when it is removed', () => {
		const { lists, stop } = setup(120);
		run(2000);
		expect(lists[0].style.transform).not.toBe('');
		stop();
		expect(lists[0].style.transform).toBe('');
		expect(lists[1].style.willChange).toBe('');
	});
});
