import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from './search.svelte.ts';
import TeamInputTest from './TeamInput.test.svelte';

afterEach(() => {
	cleanup();
});

const team = (number: number, name: string, place?: string): SearchResult => ({
	type: 'team',
	label: `${number} ${name}`,
	sublabel: place ?? null,
	href: `/teams/${number}`
});

const robotics = [
	team(16236, 'Robotics', 'Provo, UT'),
	team(22105, 'Robotics', 'Austin, TX'),
	team(3747, 'The Hive')
];

function setup(results: SearchResult[] | Error = robotics) {
	const search = vi.fn(async () => {
		if (results instanceof Error) throw results;
		return results;
	});
	const onpick = vi.fn();
	const onsubmit = vi.fn();
	const onchange = vi.fn();
	render(TeamInputTest, { props: { search, onpick, onsubmit, onchange } });
	const input = screen.getByRole('combobox', { name: 'Team' });
	return { search, onpick, onsubmit, onchange, input };
}

describe('team input', () => {
	it('lists teams that match a name with their numbers and places', async () => {
		const { input } = setup();
		await fireEvent.input(input, { target: { value: 'robotics' } });
		const options = await screen.findAllByRole('option');
		expect(options.map((option) => option.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
			'16236 Robotics Provo, UT',
			'22105 Robotics Austin, TX',
			'3747 The Hive'
		]);
		expect(input).toHaveAttribute('aria-expanded', 'true');
	});

	it('marks the first match so enter picks the team that is shown', async () => {
		const { input, onpick, onsubmit } = setup();
		await fireEvent.input(input, { target: { value: 'robotics' } });
		const [first] = await screen.findAllByRole('option');
		expect(first).toHaveAttribute('aria-selected', 'true');
		expect(input).toHaveAttribute('aria-activedescendant', first.id);
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onpick).toHaveBeenCalledWith(16236, {
			number: 16236,
			name: 'Robotics',
			place: 'Provo, UT'
		});
		expect(input).toHaveValue('16236');
		expect(onsubmit).not.toHaveBeenCalled();
		expect(screen.queryByRole('option')).not.toBeInTheDocument();
	});

	it('moves through the matches with the arrow keys', async () => {
		const { input, onpick } = setup();
		await fireEvent.input(input, { target: { value: 'robotics' } });
		await screen.findAllByRole('option');
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'ArrowUp' });
		await fireEvent.keyDown(input, { key: 'ArrowUp' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onpick).toHaveBeenCalledWith(22105, expect.objectContaining({ number: 22105 }));
	});

	it('picks a team with a click', async () => {
		const { input, onpick } = setup();
		await fireEvent.input(input, { target: { value: 'hive' } });
		await fireEvent.click(await screen.findByRole('option', { name: /3747 The Hive/ }));
		expect(onpick).toHaveBeenCalledWith(3747, expect.objectContaining({ name: 'The Hive' }));
		expect(input).toHaveValue('3747');
	});

	it('lets a typed number submit the form as before', async () => {
		const { input, onpick, onsubmit } = setup([team(3747, 'The Hive'), team(37470, 'Buzz')]);
		await fireEvent.input(input, { target: { value: '3747' } });
		await screen.findAllByRole('option');
		expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'false');
		await fireEvent.keyDown(input, { key: 'Enter' });
		await fireEvent.submit(input.closest('form') as HTMLFormElement);
		expect(onpick).not.toHaveBeenCalled();
		expect(onsubmit).toHaveBeenCalledOnce();
		expect(input).toHaveValue('3747');
	});

	it('does not look up a list of numbers', async () => {
		const { input, search } = setup();
		await fireEvent.input(input, { target: { value: '19666 7759' } });
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(search).not.toHaveBeenCalled();
		expect(input).toHaveAttribute('aria-expanded', 'false');
	});

	it('never guesses a team when nothing matches a name', async () => {
		const { input, onpick } = setup([]);
		await fireEvent.input(input, { target: { value: 'nobody here' } });
		expect(await screen.findByRole('status')).toHaveTextContent('No teams match "nobody here".');
		const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
		input.dispatchEvent(enter);
		expect(enter.defaultPrevented).toBe(true);
		expect(onpick).not.toHaveBeenCalled();
	});

	it('says when search is down and asks for a number', async () => {
		const { input } = setup(new Error('offline'));
		await fireEvent.input(input, { target: { value: 'hive' } });
		expect(await screen.findByRole('status')).toHaveTextContent(
			"Search isn't working right now. Type a team number."
		);
	});

	it('closes the list on escape and when focus leaves', async () => {
		const { input } = setup();
		await fireEvent.input(input, { target: { value: 'robotics' } });
		await screen.findAllByRole('option');
		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(input).toHaveAttribute('aria-expanded', 'false');
		await fireEvent.input(input, { target: { value: 'robotic' } });
		await screen.findAllByRole('option');
		await fireEvent.focusOut(input, {
			relatedTarget: screen.getByRole('button', { name: 'Outside' })
		});
		expect(input).toHaveAttribute('aria-expanded', 'false');
	});

	it('keeps a half typed name from applying the form', async () => {
		const { input, onchange } = setup();
		await fireEvent.change(input, { target: { value: 'robo' } });
		expect(onchange).not.toHaveBeenCalled();
		await fireEvent.change(input, { target: { value: '3747' } });
		expect(onchange).toHaveBeenCalledOnce();
	});
});
