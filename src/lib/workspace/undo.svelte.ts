export class UndoOffer {
	label = $state<string | null>(null);

	#restore: (() => void) | null = null;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#wait: number;

	constructor(wait = 8_000) {
		this.#wait = wait;
	}

	offer(label: string, restore: () => void) {
		clearTimeout(this.#timer);
		this.label = label;
		this.#restore = restore;
		this.#timer = setTimeout(() => this.dismiss(), this.#wait);
	}

	hold() {
		clearTimeout(this.#timer);
	}

	release() {
		clearTimeout(this.#timer);
		if (this.label) this.#timer = setTimeout(() => this.dismiss(), this.#wait);
	}

	undo() {
		const restore = this.#restore;
		this.dismiss();
		restore?.();
	}

	dismiss() {
		clearTimeout(this.#timer);
		this.label = null;
		this.#restore = null;
	}
}
