export const STREAM_LINK_KEY = 'ps-stream';
export const TV_STREAM_KEY = 'ps-tv-stream';

export function readTvStream(): boolean {
	try {
		return localStorage.getItem(TV_STREAM_KEY) === 'on';
	} catch {
		return false;
	}
}

export function saveTvStream(on: boolean): void {
	try {
		if (on) localStorage.setItem(TV_STREAM_KEY, 'on');
		else localStorage.removeItem(TV_STREAM_KEY);
	} catch {
		return;
	}
}
