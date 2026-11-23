import type { Attachment } from 'svelte/attachments';

let count = 0;

function place(tip: HTMLElement, target: HTMLElement) {
	const box = target.getBoundingClientRect();
	const width = tip.offsetWidth;
	const height = tip.offsetHeight;
	const left = Math.min(box.left + box.width / 2 - width / 2, window.innerWidth - width - 8);
	const below = box.bottom + 6;
	const top = below + height > window.innerHeight - 8 ? box.top - height - 6 : below;
	tip.style.left = `${Math.max(left, 8)}px`;
	tip.style.top = `${Math.max(top, 8)}px`;
}

export function termTip(text: string, nested = false): Attachment<HTMLElement> {
	return (node) => {
		const target = nested ? node.closest<HTMLElement>('a, button') : node;
		if (!target) return;

		const tip = document.createElement('span');
		tip.id = `term-tip-${++count}`;
		tip.className = 'term-tip';
		tip.setAttribute('role', 'tooltip');
		tip.hidden = true;
		tip.textContent = text;
		tip.setAttribute('popover', 'manual');
		document.body.append(tip);
		target.setAttribute('aria-describedby', tip.id);

		let timer: ReturnType<typeof setTimeout> | undefined;

		function hide() {
			clearTimeout(timer);
			if (tip.hidden) return;
			if (tip.matches(':popover-open')) tip.hidePopover();
			tip.hidden = true;
			document.removeEventListener('keydown', escape);
			document.removeEventListener('pointerdown', outside, true);
			window.removeEventListener('scroll', hide, true);
			window.removeEventListener('resize', hide);
		}

		function show() {
			clearTimeout(timer);
			if (!tip.hidden) return;
			tip.hidden = false;
			tip.showPopover?.();
			place(tip, target!);
			document.addEventListener('keydown', escape);
			document.addEventListener('pointerdown', outside, true);
			window.addEventListener('scroll', hide, true);
			window.addEventListener('resize', hide);
		}

		function escape(event: KeyboardEvent) {
			if (event.key === 'Escape') hide();
		}

		function outside(event: PointerEvent) {
			const node = event.target as Node;
			if (!target!.contains(node) && !tip.contains(node)) hide();
		}

		function leave() {
			clearTimeout(timer);
			timer = setTimeout(hide, 120);
		}

		function hover(event: PointerEvent) {
			if (event.pointerType !== 'touch') show();
		}

		function focus() {
			if (!nested || target!.matches(':focus-visible')) show();
		}

		const stay = () => clearTimeout(timer);
		const on = nested ? [] : ([['click', show]] as const);
		const events = [
			['pointerenter', hover],
			['pointerleave', leave],
			['focus', focus],
			['blur', hide],
			...on
		] as const;

		for (const [name, handler] of events) target.addEventListener(name, handler as EventListener);
		tip.addEventListener('pointerenter', stay);
		tip.addEventListener('pointerleave', leave);

		return () => {
			hide();
			for (const [name, handler] of events)
				target.removeEventListener(name, handler as EventListener);
			target.removeAttribute('aria-describedby');
			tip.remove();
		};
	};
}
