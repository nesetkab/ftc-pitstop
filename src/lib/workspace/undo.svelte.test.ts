import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UndoOffer } from '#lib/workspace/undo.svelte.ts';

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('undo offer', () => {
	it('runs the restore once and clears the label', () => {
		const offer = new UndoOffer();
		const restore = vi.fn();
		offer.offer('Removed 2844.', restore);
		expect(offer.label).toBe('Removed 2844.');
		offer.undo();
		offer.undo();
		expect(restore).toHaveBeenCalledTimes(1);
		expect(offer.label).toBeNull();
	});

	it('expires after a while', () => {
		const offer = new UndoOffer(1000);
		const restore = vi.fn();
		offer.offer('Removed 2844.', restore);
		vi.advanceTimersByTime(1000);
		expect(offer.label).toBeNull();
		offer.undo();
		expect(restore).not.toHaveBeenCalled();
	});

	it('replaces an older offer with the newest one', () => {
		const offer = new UndoOffer(1000);
		const first = vi.fn();
		const second = vi.fn();
		offer.offer('Removed 1.', first);
		vi.advanceTimersByTime(800);
		offer.offer('Removed 2.', second);
		vi.advanceTimersByTime(800);
		expect(offer.label).toBe('Removed 2.');
		offer.undo();
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});

	it('waits while held and restarts the clock on release', () => {
		const offer = new UndoOffer(1000);
		offer.offer('Removed 3.', vi.fn());
		offer.hold();
		vi.advanceTimersByTime(5000);
		expect(offer.label).toBe('Removed 3.');
		offer.release();
		vi.advanceTimersByTime(999);
		expect(offer.label).toBe('Removed 3.');
		vi.advanceTimersByTime(1);
		expect(offer.label).toBeNull();
	});
});
