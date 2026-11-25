import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => navigation);
import { RECENT_KEY } from './recent-searches.ts';
import SearchDialog from './SearchDialog.svelte';
import type { SearchFn, SearchResult } from './search.svelte.ts';

const results: SearchResult[] = [
	{
		type: 'team',
		label: '14624 Cat-Astrophic Byte',
		sublabel: 'Waddell, Arizona',
		href: '/teams/14624'
	},
	{
		type: 'event',
		label: 'Roadrunner - Gilbert Qualifier',
		sublabel: 'USAZGIQ',
		href: '/events/USAZGIQ'
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
	localStorage.clear();
	navigation.goto.mockClear();
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

	it('groups results by type, best group first, and makes the first result active', async () => {
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

	it('puts events first when the best match is an event', async () => {
		setup(async () => [results[1], results[0]]);
		await openAndType('gilbert');
		expect(screen.getAllByRole('option').map((option) => option.getAttribute('href'))).toEqual([
			'/events/USAZGIQ',
			'/teams/14624'
		]);
	});

	it('remembers picked results and shows them when the field is empty', async () => {
		const { dialog } = setup();
		const input = await openAndType('ca');
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(dialog).not.toHaveAttribute('open');
		expect(JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')[0].href).toBe('/teams/14624');
		await fireEvent.keyDown(document.body, { key: '/' });
		await fireEvent.input(screen.getByRole('combobox'), { target: { value: '' } });
		const [option] = await screen.findAllByRole('option');
		expect(option).toHaveAttribute('href', '/teams/14624');
		expect(option).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByText('Recent')).toBeInTheDocument();
	});

	it('clears recent results', async () => {
		localStorage.setItem(
			RECENT_KEY,
			JSON.stringify([{ type: 'team', label: '1 One', href: '/teams/1' }])
		);
		setup();
		await fireEvent.keyDown(document.body, { key: '/' });
		expect(await screen.findByRole('option')).toHaveAttribute('href', '/teams/1');
		await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
		expect(screen.queryByRole('option')).not.toBeInTheDocument();
		expect(localStorage.getItem(RECENT_KEY)).toBeNull();
	});

	it('jumps straight to a team number on Enter before results arrive', async () => {
		const { dialog } = setup(() => new Promise(() => {}));
		await fireEvent.keyDown(document.body, { key: '/' });
		const input = screen.getByRole('combobox');
		await fireEvent.input(input, { target: { value: '3747' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(navigation.goto).toHaveBeenCalledWith('/teams/3747');
		expect(dialog).not.toHaveAttribute('open');
	});

	it('shows the place or dates next to the name and bolds the match', async () => {
		setup(async () => [
			{ type: 'team', label: '3747 The Hive', aside: 'Sandy, Utah', href: '/teams/3747' },
			{ type: 'event', label: 'Butte', aside: 'Day 2 of 2', live: true, href: '/events/USMTBUQ' }
		]);
		await openAndType('hive');
		expect(screen.getByText('Sandy, Utah')).toBeInTheDocument();
		expect(screen.getByText('Day 2 of 2')).toHaveClass('live');
		expect(screen.getByText('Hive').tagName).toBe('MARK');
	});

	it('filters to teams or events with the buttons above the results', async () => {
		setup();
		const input = await openAndType('ca');
		const events = screen.getByRole('button', { name: 'Events 1' });
		expect(screen.getByRole('button', { name: 'All 3' })).toHaveAttribute('aria-pressed', 'true');
		await fireEvent.click(events);
		expect(events).toHaveAttribute('aria-pressed', 'true');
		const options = screen.getAllByRole('option');
		expect(options.map((option) => option.getAttribute('href'))).toEqual(['/events/USAZGIQ']);
		expect(options[0]).toHaveAttribute('aria-selected', 'true');
		expect(input).toHaveFocus();
		await fireEvent.click(screen.getByRole('button', { name: 'Teams 2' }));
		expect(screen.getAllByRole('option')).toHaveLength(2);
	});

	it('hides the filter buttons when only one kind of result comes back', async () => {
		setup(async () => [results[0], results[2]]);
		await openAndType('ca');
		expect(screen.queryByRole('group', { name: 'Show' })).not.toBeInTheDocument();
	});
});
