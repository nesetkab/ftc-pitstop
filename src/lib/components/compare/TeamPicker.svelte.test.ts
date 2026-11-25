import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeamPicker from './TeamPicker.svelte';

const navigation = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => navigation);

beforeEach(() => {
	navigation.goto.mockReset();
});

afterEach(() => {
	cleanup();
});

const search = vi.fn(async () => [
	{ type: 'team' as const, label: '3747 The Hive', href: '/teams/3747' },
	{ type: 'team' as const, label: '724 RedNek Robotics', href: '/teams/724' }
]);

function setup() {
	render(TeamPicker, {
		props: {
			teams: [{ number: 724, name: 'RedNek Robotics', place: 'Gilbert, AZ' }],
			suggestions: [],
			search,
			delay: 0
		}
	});
	return screen.getByRole('combobox', { name: 'Team number or name to add' });
}

describe('compare team picker', () => {
	it('keeps sending typed numbers with the form', () => {
		const input = setup();
		expect(input).toHaveAttribute('name', 'add');
		expect(input.closest('form')).toHaveAttribute('action', '/compare');
	});

	it('adds a team picked by name', async () => {
		const input = setup();
		await fireEvent.input(input, { target: { value: 'hive' } });
		await fireEvent.click(await screen.findByRole('option', { name: /3747 The Hive/ }));
		expect(navigation.goto).toHaveBeenCalledWith('/compare?teams=724,3747', { reset: false });
		expect(input).toHaveValue('');
	});

	it('does nothing for a team already being compared', async () => {
		const input = setup();
		await fireEvent.input(input, { target: { value: 'rednek' } });
		await fireEvent.click(await screen.findByRole('option', { name: /724 RedNek Robotics/ }));
		expect(navigation.goto).not.toHaveBeenCalled();
	});
});
