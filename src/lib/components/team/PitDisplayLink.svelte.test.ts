import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PitDisplayLink from './PitDisplayLink.svelte';

const navigation = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => navigation);

beforeEach(() => {
	navigation.goto.mockReset();
});

afterEach(() => {
	cleanup();
});

const field = () => screen.getByRole('textbox', { name: 'Team number' });
const open = () => screen.getByRole('button', { name: 'Open' });

describe('pit display link', () => {
	it('shows the address the team will get', () => {
		render(PitDisplayLink);
		expect(screen.getByText('Open the pit display for your team')).toBeInTheDocument();
		expect(screen.getByText('ftcpitstop.com/')).toBeInTheDocument();
		expect(screen.getByText('/tv')).toBeInTheDocument();
		expect(open()).toBeDisabled();
	});

	it('makes the whole address box a tap target for the field', () => {
		render(PitDisplayLink);
		const box = field().closest('label');
		expect(box).toContainElement(screen.getByText('ftcpitstop.com/'));
		expect(box).toContainElement(screen.getByText('/tv'));
		expect((field() as HTMLInputElement).labels).toHaveLength(1);
	});

	it('opens the pit display for the team number that was typed', async () => {
		render(PitDisplayLink);
		await fireEvent.input(field(), { target: { value: '26670' } });
		expect(open()).toBeEnabled();
		await fireEvent.click(open());
		expect(navigation.goto).toHaveBeenCalledWith('/26670/tv');
	});

	it('opens it when enter is pressed in the field', async () => {
		render(PitDisplayLink);
		await fireEvent.input(field(), { target: { value: ' 3747 ' } });
		await fireEvent.submit(field().closest('form') as HTMLFormElement);
		expect(navigation.goto).toHaveBeenCalledWith('/3747/tv');
	});

	it('does nothing for something that is not a team number', async () => {
		render(PitDisplayLink);
		for (const value of ['abc', '0', '12a', '1234567', '-5']) {
			await fireEvent.input(field(), { target: { value } });
			expect(open()).toBeDisabled();
			await fireEvent.submit(field().closest('form') as HTMLFormElement);
		}
		expect(navigation.goto).not.toHaveBeenCalled();
	});
});
