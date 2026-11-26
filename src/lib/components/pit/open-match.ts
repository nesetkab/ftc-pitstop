import { getContext, setContext } from 'svelte';

type OpenMatch = (key: string) => void;

const KEY = Symbol('open-match');

export function provideOpenMatch(open: OpenMatch): void {
	setContext(KEY, open);
}

/** Undefined where there is no score breakdown to open, so nothing looks clickable. */
export function useOpenMatch(): OpenMatch | undefined {
	return getContext<OpenMatch | undefined>(KEY);
}
