import { flip } from 'svelte/animate';
import type { AnimationConfig } from 'svelte/animate';
import type { Attachment } from 'svelte/attachments';
import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

type Timing = { duration?: number; delay?: number };
type Rise = Timing & { y?: number };
type Move = { duration?: number; off?: boolean };

export function reduced(): boolean {
	return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function timing(duration: number, delay = 0) {
	return reduced() ? { duration: 0, delay: 0 } : { duration, delay };
}

export function fade(_node: Element, { duration = 160, delay = 0 }: Timing = {}): TransitionConfig {
	return { ...timing(duration, delay), easing: cubicOut, css: (t) => `opacity: ${t}` };
}

export function rise(
	_node: Element,
	{ duration = 200, delay = 0, y = 6 }: Rise = {}
): TransitionConfig {
	return {
		...timing(duration, delay),
		easing: cubicOut,
		css: (t, u) => `opacity: ${t}; translate: 0 ${u * y}px`
	};
}

export function move(
	node: Element,
	rects: { from: DOMRect; to: DOMRect },
	{ duration = 240, off = false }: Move = {}
): AnimationConfig {
	return flip(node, rects, { duration: off ? 0 : timing(duration).duration, easing: cubicOut });
}

export const reveal: Attachment<HTMLElement> = (node) => {
	if (reduced() || typeof IntersectionObserver === 'undefined') return;
	let first = true;
	const observer = new IntersectionObserver(
		([entry]) => {
			if (first) {
				first = false;
				if (entry.isIntersecting) observer.disconnect();
				else node.dataset.reveal = 'wait';
			} else if (entry.intersectionRatio >= 0.3) {
				node.dataset.reveal = 'draw';
				observer.disconnect();
			}
		},
		{ threshold: [0, 0.3] }
	);
	observer.observe(node);
	return () => observer.disconnect();
};
