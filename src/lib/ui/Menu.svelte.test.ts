import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import MenuExample from './Menu.test.svelte';

afterEach(cleanup);

function setup() {
	const { container } = render(MenuExample);
	const menu = container.querySelector('details')!;
	const summary = container.querySelector('summary')!;
	menu.open = true;
	return { menu, summary };
}

describe('Menu', () => {
	it('closes on Escape and hands focus back to its button', async () => {
		const { menu, summary } = setup();
		const item = screen.getByRole('link', { name: 'Phone view' });
		item.focus();
		await fireEvent.keyDown(item, { key: 'Escape' });
		expect(menu.open).toBe(false);
		expect(summary).toHaveFocus();
	});

	it('leaves Escape alone when focus is somewhere else', async () => {
		const { menu } = setup();
		const outside = screen.getByRole('button', { name: 'Outside' });
		outside.focus();
		await fireEvent.keyDown(outside, { key: 'Escape' });
		expect(menu.open).toBe(true);
		expect(outside).toHaveFocus();
	});

	it('closes when focus tabs out of it', async () => {
		const { menu } = setup();
		const item = screen.getByRole('link', { name: 'Phone view' });
		const outside = screen.getByRole('button', { name: 'Outside' });
		await fireEvent.focusOut(item, { relatedTarget: outside });
		expect(menu.open).toBe(false);
	});

	it('stays open while focus moves between its items', async () => {
		const { menu } = setup();
		const first = screen.getByRole('link', { name: 'TV display' });
		const second = screen.getByRole('link', { name: 'Phone view' });
		await fireEvent.focusOut(first, { relatedTarget: second });
		expect(menu.open).toBe(true);
	});

	it('returns focus to its button when an item closes it', async () => {
		const { menu, summary } = setup();
		const item = screen.getByRole('link', { name: 'TV display' });
		item.focus();
		await fireEvent.click(item);
		expect(menu.open).toBe(false);
		expect(summary).toHaveFocus();
	});

	it('closes on a click outside', async () => {
		const { menu } = setup();
		await fireEvent.click(screen.getByRole('button', { name: 'Outside' }));
		expect(menu.open).toBe(false);
	});
});
