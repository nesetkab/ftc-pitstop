import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StaleNotice from './StaleNotice.svelte';

const NOW = new Date('2026-11-14T20:41:14Z');

function secondsAgo(seconds: number) {
	return new Date(NOW.getTime() - seconds * 1000);
}

beforeEach(() => {
	vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('StaleNotice', () => {
	it('says how long ago the data was updated', () => {
		const { container } = render(StaleNotice, { props: { updated: secondsAgo(12) } });
		const notice = container.querySelector('time');
		expect(notice).toHaveTextContent('Updated 12 seconds ago');
		expect(notice).toHaveAttribute('datetime', secondsAgo(12).toISOString());
		expect(notice).not.toHaveClass('stale');
	});

	it('ticks every second', () => {
		const { container } = render(StaleNotice, { props: { updated: secondsAgo(12) } });
		vi.advanceTimersByTime(3000);
		flushSync();
		expect(container.querySelector('time')).toHaveTextContent('Updated 15 seconds ago');
	});

	it('turns into a warning once the data is older than the threshold', () => {
		const { container } = render(StaleNotice, {
			props: { updated: secondsAgo(50), staleAfter: 60 }
		});
		expect(container.querySelector('time')).not.toHaveClass('stale');
		vi.advanceTimersByTime(10_000);
		flushSync();
		expect(container.querySelector('time')).not.toHaveClass('stale');
		vi.advanceTimersByTime(1000);
		flushSync();
		const notice = container.querySelector('time');
		expect(notice).toHaveClass('stale');
		expect(notice).toHaveTextContent('Updated 1 minute ago');
	});

	it('ticks less often once the data is old', () => {
		const timeout = vi.spyOn(globalThis, 'setTimeout');
		const { container } = render(StaleNotice, { props: { updated: secondsAgo(600) } });
		expect(timeout).toHaveBeenLastCalledWith(expect.any(Function), 15_000);
		vi.advanceTimersByTime(60_000);
		expect(timeout).toHaveBeenCalledTimes(5);
		flushSync();
		expect(container.querySelector('time')).toHaveTextContent('Updated 11 minutes ago');
	});

	it('uses a two minute threshold by default', () => {
		const fresh = render(StaleNotice, { props: { updated: secondsAgo(119) } });
		expect(fresh.container.querySelector('time')).not.toHaveClass('stale');
		const old = render(StaleNotice, { props: { updated: secondsAgo(121) } });
		expect(old.container.querySelector('time')).toHaveClass('stale');
	});

	it('treats a time slightly in the future as just now', () => {
		const { container } = render(StaleNotice, { props: { updated: secondsAgo(-3) } });
		expect(container.querySelector('time')).toHaveTextContent('Updated just now');
	});

	it('renders nothing without a time', () => {
		const { container } = render(StaleNotice, { props: { updated: null } });
		expect(container.querySelector('time')).toBeNull();
	});
});
