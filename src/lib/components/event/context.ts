import { getContext, setContext } from 'svelte';

export type EventView = {
	readonly followed: ReadonlySet<number>;
};

const KEY = Symbol('event-view');

const EMPTY: EventView = { followed: new Set() };

export function setEventView(view: EventView): void {
	setContext(KEY, view);
}

export function getEventView(): EventView {
	return getContext<EventView | undefined>(KEY) ?? EMPTY;
}
