import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import FilterPanelExample from './FilterPanel.test.svelte';

afterEach(cleanup);

describe('FilterPanel', () => {
	it('closes on Escape from inside and hands focus back to the toggle', async () => {
		render(FilterPanelExample);
		const toggle = screen.getByRole('button', { name: 'Filters' });
		await fireEvent.click(toggle);
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		const region = screen.getByRole('combobox', { name: 'Region' });
		region.focus();
		await fireEvent.keyDown(region, { key: 'Escape' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(toggle).toHaveFocus();
	});

	it('ignores Escape pressed elsewhere on the page', async () => {
		render(FilterPanelExample);
		const toggle = screen.getByRole('button', { name: 'Filters' });
		await fireEvent.click(toggle);
		const outside = screen.getByRole('button', { name: 'Outside' });
		outside.focus();
		await fireEvent.keyDown(outside, { key: 'Escape' });
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		expect(outside).toHaveFocus();
	});
});
