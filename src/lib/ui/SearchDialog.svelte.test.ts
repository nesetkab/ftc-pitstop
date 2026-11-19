import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import SearchDialog from './SearchDialog.svelte';
import type { SearchFn, SearchResult } from './search.svelte.ts';

const results: SearchResult[] = [
	{
		type: 'event',
		label: 'Roadrunner - Gilbert Qualifier',
		sublabel: 'USAZGIQ',
		href: '/events/USAZGIQ'
	},
	{
		type: 'team',
		label: '14624 Cat-Astrophic Byte',
		sublabel: 'Waddell, Arizona',
		href: '/teams/14624'
	},
	{ type: 'team', label: '26128 Wrightly Reconfigured Robots', href: '/teams/26128' }
];

beforeAll(() => {
	HTMLDialogElement.prototype.showModal = function () {
		this.setAttribute('open', '');
	};
	HTMLDialogElement.prototype.close = function () {
		this.removeAttribute('open');
		this.dispatchEvent(new Event('close'));
	};
});

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
});

function setup(search: SearchFn = async () => results) {
	const onselect = vi.fn();
	render(SearchDialog, { props: { search, onselect, delay: 0 } });
	const dialog = document.querySelector('dialog');
	if (!dialog) throw new Error('No dialog rendered');
	return { dialog, onselect };
}

async function openAndType(query: string) {
	await fireEvent.keyDown(document.body, { key: '/' });
	const input = screen.getByRole('combobox');
	await fireEvent.input(input, { target: { value: query } });
	await screen.findAllByRole('option');
	return input;
}

describe('SearchDialog', () => {
	it('opens with the slash key and focuses the field', async () => {
		const { dialog } = setup();
		expect(dialog).not.toHaveAttribute('open');
		await fireEvent.keyDown(document.body, { key: '/' });
		expect(dialog).toHaveAttribute('open');
		expect(screen.getByRole('combobox')).toHaveFocus();
	});

	it('opens with Ctrl+K and Cmd+K', async () => {
		const { dialog } = setup();
		await fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
		expect(dialog).toHaveAttribute('open');
		await fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
		expect(dialog).not.toHaveAttribute('open');
		await fireEvent.keyDown(document.body, { key: 'K', metaKey: true });
		expect(dialog).toHaveAttribute('open');
	});

	it('ignores the slash key while typing in another field', async () => {
		const { dialog } = setup();
		const other = document.createElement('input');
		document.body.append(other);
		await fireEvent.keyDown(other, { key: '/' });
		expect(dialog).not.toHaveAttribute('open');
	});

	it('groups teams before events and makes the first result active', async () => {
		const search = vi.fn<SearchFn>(async () => results);
		setup(search);
		const input = await openAndType('ca');
		expect(search).toHaveBeenCalledWith('ca', expect.any(AbortSignal));
		const options = screen.getAllByRole('option');
		expect(options.map((option) => option.getAttribute('href'))).toEqual([
			'/teams/14624',
			'/teams/26128',
			'/events/USAZGIQ'
		]);
		expect(options[0]).toHaveAttribute('aria-selected', 'true');
		expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
		expect(input).toHaveAttribute('aria-expanded', 'true');
	});

	it('moves through results with the arrow keys and wraps around', async () => {
		setup();
		const input = await openAndType('ca');
		const options = screen.getAllByRole('option');
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		expect(options[1]).toHaveAttribute('aria-selected', 'true');
		expect(options[0]).toHaveAttribute('aria-selected', 'false');
		expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		expect(options[0]).toHaveAttribute('aria-selected', 'true');
		await fireEvent.keyDown(input, { key: 'ArrowUp' });
		expect(options[2]).toHaveAttribute('aria-selected', 'true');
	});

	it('picks the active result with Enter and closes', async () => {
		const { dialog, onselect } = setup();
		const input = await openAndType('ca');
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onselect).toHaveBeenCalledWith(results[2]);
		expect(dialog).not.toHaveAttribute('open');
	});

	it('closes with Escape without picking anything', async () => {
		const { dialog, onselect } = setup();
		const input = await openAndType('ca');
		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(dialog).not.toHaveAttribute('open');
		expect(onselect).not.toHaveBeenCalled();
	});

	it('says when nothing matches', async () => {
		setup(async () => []);
		await fireEvent.keyDown(document.body, { key: '/' });
		await fireEvent.input(screen.getByRole('combobox'), { target: { value: 'zz' } });
		expect(await screen.findByText('No teams or events match "zz".')).toBeInTheDocument();
		expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
	});

	it('says when search fails', async () => {
		setup(async () => Promise.reject(new Error('offline')));
		await fireEvent.keyDown(document.body, { key: '/' });
		await fireEvent.input(screen.getByRole('combobox'), { target: { value: 'zz' } });
		expect(
			await screen.findByText("Search isn't working right now. Try again in a moment.")
		).toBeInTheDocument();
	});
});
