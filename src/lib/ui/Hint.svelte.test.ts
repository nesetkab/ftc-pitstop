import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HINTS_KEY } from './hints.ts';
import HintExample from './Hint.test.svelte';

beforeEach(() => localStorage.clear());

afterEach(cleanup);

describe('Hint', () => {
	it('shows its line with a link until it is hidden', async () => {
		render(HintExample);
		expect(await screen.findByRole('link', { name: 'pit display' })).toHaveAttribute(
			'href',
			'/26670/tv'
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
		expect(screen.queryByRole('link', { name: 'pit display' })).not.toBeInTheDocument();
		expect(localStorage.getItem(HINTS_KEY)).toBe('["pit"]');
	});

	it('stays hidden on later visits once dismissed', async () => {
		localStorage.setItem(HINTS_KEY, '["pit"]');
		render(HintExample);
		await Promise.resolve();
		expect(screen.queryByText(/on your pit TV/)).not.toBeInTheDocument();
	});
});
