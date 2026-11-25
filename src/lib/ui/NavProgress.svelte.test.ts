import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NavProgress from './NavProgress.svelte';
import { navigating } from './nav-progress-fixture.svelte.ts';

vi.mock('$app/state', async () => import('./nav-progress-fixture.svelte.ts'));

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	navigating.to = null;
	flushSync();
	vi.useRealTimers();
	cleanup();
});

const bar = () => document.querySelector('.progress');

function navigate(to: unknown) {
	navigating.to = to;
	flushSync();
}

describe('NavProgress', () => {
	it('shows nothing for a fast navigation', () => {
		render(NavProgress);
		navigate({ url: new URL('https://example.com/events') });
		vi.advanceTimersByTime(100);
		navigate(null);
		vi.advanceTimersByTime(1000);
		flushSync();
		expect(bar()).not.toBeInTheDocument();
	});

	it('shows a bar while a slow navigation runs, then clears it', () => {
		render(NavProgress);
		navigate({ url: new URL('https://example.com/events') });
		vi.advanceTimersByTime(200);
		flushSync();
		expect(bar()).toHaveClass('running');
		expect(bar()).toHaveAttribute('aria-hidden', 'true');
		navigate(null);
		expect(bar()).toHaveClass('done');
		vi.advanceTimersByTime(400);
		flushSync();
		expect(bar()).not.toBeInTheDocument();
	});
});
