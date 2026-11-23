import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UndoOffer } from '#lib/workspace/undo.svelte.ts';
import UndoBar from './UndoBar.svelte';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

function offered(restore = vi.fn()) {
	const offer = new UndoOffer(1000);
	render(UndoBar, { props: { offer } });
	offer.offer('Removed 2844.', restore);
	flushSync();
	return { offer, restore };
}

describe('UndoBar', () => {
	it('undoes with Control or Command Z', async () => {
		const { restore } = offered();
		expect(screen.getByRole('button', { name: 'Undo' })).toHaveAttribute(
			'aria-keyshortcuts',
			'Control+Z Meta+Z'
		);
		await fireEvent.keyDown(window, { key: 'z', metaKey: true });
		expect(restore).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
	});

	it('leaves Control Z alone while typing', async () => {
		const { restore } = offered();
		const input = document.createElement('input');
		document.body.append(input);
		await fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
		expect(restore).not.toHaveBeenCalled();
		input.remove();
	});

	it('stays while focus is inside it', async () => {
		const { offer } = offered();
		await fireEvent.focusIn(screen.getByRole('button', { name: 'Undo' }));
		vi.advanceTimersByTime(5000);
		expect(offer.label).toBe('Removed 2844.');
		await fireEvent.focusOut(screen.getByRole('button', { name: 'Undo' }));
		vi.advanceTimersByTime(1000);
		expect(offer.label).toBeNull();
	});
});
