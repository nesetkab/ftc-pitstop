import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Pagination from './Pagination.svelte';

const navigation = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => navigation);

beforeEach(() => {
	navigation.goto.mockReset();
});

afterEach(() => {
	cleanup();
});

const href = (page: number) => (page === 1 ? '/list' : `/list?page=${page}`);
const show = (page = 2, pages = 12) => render(Pagination, { props: { page, pages, href } });
const box = () => screen.getByRole('textbox', { name: 'Page' }) as HTMLInputElement;

describe('Pagination', () => {
	it('shows the current page in a box labeled for screen readers', () => {
		show();
		expect(box()).toHaveValue('2');
		expect(box()).toHaveAttribute('inputmode', 'numeric');
		expect(box()).toHaveAccessibleDescription('of 12');
	});

	it('goes to the typed page on Enter', async () => {
		show();
		await fireEvent.input(box(), { target: { value: '7' } });
		await fireEvent.keyDown(box(), { key: 'Enter' });
		expect(navigation.goto).toHaveBeenCalledWith('/list?page=7');
	});

	it('goes to the typed page when the box loses focus', async () => {
		show();
		await fireEvent.input(box(), { target: { value: '1' } });
		await fireEvent.change(box());
		expect(navigation.goto).toHaveBeenCalledWith('/list');
	});

	it('keeps the page in range', async () => {
		show();
		await fireEvent.input(box(), { target: { value: '99' } });
		await fireEvent.keyDown(box(), { key: 'Enter' });
		expect(navigation.goto).toHaveBeenLastCalledWith('/list?page=12');
		expect(box()).toHaveValue('12');
		cleanup();
		show(5);
		await fireEvent.input(box(), { target: { value: '0' } });
		await fireEvent.keyDown(box(), { key: 'Enter' });
		expect(navigation.goto).toHaveBeenLastCalledWith('/list');
	});

	it('puts the current page back when the entry is not a number', async () => {
		show(3);
		await fireEvent.input(box(), { target: { value: 'abc' } });
		await fireEvent.keyDown(box(), { key: 'Enter' });
		expect(box()).toHaveValue('3');
		expect(navigation.goto).not.toHaveBeenCalled();
	});

	it('stays put when the typed page is the current one', async () => {
		show(4);
		await fireEvent.change(box());
		await fireEvent.keyDown(box(), { key: 'Enter' });
		expect(navigation.goto).not.toHaveBeenCalled();
	});

	it('asks for the page once when Enter is followed by a change', async () => {
		show();
		await fireEvent.input(box(), { target: { value: '6' } });
		await fireEvent.keyDown(box(), { key: 'Enter' });
		await fireEvent.change(box());
		expect(navigation.goto).toHaveBeenCalledTimes(1);
	});

	it('keeps the previous and next links', () => {
		show();
		expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/list');
		expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/list?page=3');
	});

	it('follows a new page from the parent', async () => {
		const view = show(2);
		await view.rerender({ page: 8, pages: 12, href });
		expect(box()).toHaveValue('8');
	});
});
