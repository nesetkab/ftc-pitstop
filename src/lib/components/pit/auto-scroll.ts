/** Lines of text that go past per second. */
const LINES_PER_SECOND = 1.2;
/** How often the sizes are measured, in milliseconds. Measuring every frame would force layout. */
const MEASURE_EVERY = 500;
/** Longest time one frame may move the list, so a stalled tab doesn't make it jump. */
const MAX_STEP = 100;

/**
 * Scrolls a box round and round without stopping, except while the pointer is on it.
 * When the content is too tall, `onloop(true)` asks for a second copy of it right below
 * the first, so the jump back to the start can't be seen.
 *
 * The movement is a transform that is worked out from the clock on every screen frame.
 * `scrollTop` and a timer would both step: browsers round `scrollTop` to whole pixels and a
 * timer isn't tied to the screen refresh. While the pointer is on the box the transform
 * hands over to ordinary scrolling, so a person can still scroll it by hand.
 */
export function autoScroll(onloop: (looping: boolean) => void) {
	return (box: HTMLElement): (() => void) => {
		let position = 0;
		let period = 0;
		let looping = false;
		let hovered = false;
		let last: number | null = null;
		let measured = -Infinity;
		let frame = 0;

		const parts = () => Array.from(box.children) as HTMLElement[];

		function place(offset: number) {
			for (const part of parts()) {
				part.style.transform = offset === 0 ? '' : `translate3d(0, ${-offset}px, 0)`;
				part.style.willChange = offset === 0 ? '' : 'transform';
			}
		}

		function measure() {
			const [first, second] = parts();
			const height = first?.getBoundingClientRect().height ?? 0;
			const tall = height > box.clientHeight + 1;
			if (tall !== looping) {
				looping = tall;
				onloop(tall);
				// The second copy is drawn before the next frame; measure again then.
				measured = -Infinity;
			}
			// The distance between the two copies is the exact length of one lap. Both are moved by
			// the same transform, so it doesn't matter where in the lap they are.
			period =
				looping && second
					? second.getBoundingClientRect().top - first.getBoundingClientRect().top
					: 0;
		}

		function step(now: number) {
			frame = requestAnimationFrame(step);
			const elapsed = last === null ? 0 : Math.min(now - last, MAX_STEP);
			last = now;
			if (now - measured >= MEASURE_EVERY) {
				measured = now;
				measure();
			}
			if (period <= 0) {
				// Fits, or the second copy hasn't arrived yet.
				if (position !== 0 && !hovered) {
					position = 0;
					place(0);
				}
				return;
			}
			if (hovered) return;
			const size = parseFloat(getComputedStyle(box).fontSize) || 16;
			position = (position + (size * LINES_PER_SECOND * elapsed) / 1000) % period;
			place(position);
		}

		function enter() {
			if (hovered) return;
			hovered = true;
			// Hand the position to the scroll bar so the person carries on from the same spot.
			place(0);
			box.scrollTop = position;
		}

		function leave() {
			if (!hovered) return;
			hovered = false;
			position = period > 0 ? box.scrollTop % period : 0;
			box.scrollTop = 0;
			place(position);
			last = null;
		}

		box.addEventListener('pointerenter', enter);
		box.addEventListener('pointerleave', leave);
		box.addEventListener('pointercancel', leave);
		frame = requestAnimationFrame(step);

		return () => {
			cancelAnimationFrame(frame);
			box.removeEventListener('pointerenter', enter);
			box.removeEventListener('pointerleave', leave);
			box.removeEventListener('pointercancel', leave);
			place(0);
		};
	};
}
