import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BatteryLog from '#lib/components/tools/BatteryLog.svelte';
import type { Batteries, Battery } from '#lib/workspace/schemas.ts';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const MIN = 60_000;

function battery(name: string, overrides: Partial<Battery> = {}): Battery {
	return {
		id: name.toLowerCase(),
		name,
		status: 'charged',
		voltage: 13,
		used: [],
		note: '',
		restedSince: Date.now() - 30 * MIN,
		...overrides
	};
}

type Change = (batteries: Batteries) => Batteries;

function setup(items: Battery[], extra: Record<string, unknown> = {}) {
	const state = { current: { items } as Batteries };
	const update = vi.fn((change: Change) => {
		state.current = change(state.current);
	});
	const view = render(BatteryLog, { props: { batteries: state.current, update, ...extra } });
	const refresh = () => view.rerender({ batteries: state.current, update, ...extra });
	return { state, update, refresh };
}

const row = (name: string) =>
	screen.getByLabelText(`Status of ${name}`).closest('tr') as HTMLElement;

describe('battery log', () => {
	it('suggests the charged battery with the highest voltage', () => {
		setup([
			battery('B1', { voltage: 12.9 }),
			battery('B4', { voltage: 13.1, restedSince: Date.now() - 24 * MIN }),
			battery('B2', { status: 'in-robot', voltage: 13.4 })
		]);
		const banner = screen.getByText('Use next: B4').parentElement as HTMLElement;
		expect(banner).toHaveTextContent('13.1 V');
		expect(banner).toHaveTextContent('rested 24 min');
		expect(row('B4')).toHaveClass('next');
		expect(row('B1')).not.toHaveClass('next');
		expect(within(row('B4')).getByText(/Use next/)).toBeInTheDocument();
	});

	it('says so when nothing is charged', () => {
		setup([battery('B1', { status: 'charging' })]);
		expect(screen.queryByText(/Use next:/)).toBeNull();
		expect(screen.getByText('No battery is marked charged.')).toBeInTheDocument();
	});

	it('puts a battery in the robot and logs the next match', async () => {
		const { state } = setup([battery('B1'), battery('B2', { status: 'in-robot' })], {
			match: 'Q26'
		});
		await fireEvent.click(within(row('B1')).getByRole('button', { name: 'Put in robot' }));
		const [b1, b2] = state.current.items;
		expect(b1).toMatchObject({ status: 'in-robot', used: ['Q26'] });
		expect(b2.status).toBe('charging');
	});

	it('marks a battery charged', async () => {
		const { state } = setup([battery('B1', { status: 'charging', restedSince: null })]);
		await fireEvent.click(screen.getByRole('button', { name: 'Mark charged' }));
		expect(state.current.items[0].status).toBe('charged');
		expect(state.current.items[0].restedSince).not.toBeNull();
	});

	it('turns off actions that would change nothing', () => {
		setup([battery('B1'), battery('B2', { status: 'in-robot' })]);
		expect(within(row('B1')).getByRole('button', { name: 'Mark charged' })).toBeDisabled();
		expect(within(row('B2')).getByRole('button', { name: 'Put in robot' })).toBeDisabled();
	});

	it('edits voltage, matches, note and status', async () => {
		const { state } = setup([battery('B1', { voltage: null })]);
		await fireEvent.change(screen.getByLabelText('Voltage of B1'), { target: { value: '12.6' } });
		expect(state.current.items[0].voltage).toBe(12.6);
		await fireEvent.change(screen.getByLabelText('Matches B1 was used in'), {
			target: { value: 'Q5, Q14' }
		});
		expect(state.current.items[0].used).toEqual(['Q5', 'Q14']);
		await fireEvent.input(screen.getByLabelText('Note for B1'), {
			target: { value: 'Dropped low' }
		});
		expect(state.current.items[0].note).toBe('Dropped low');
		await fireEvent.change(screen.getByLabelText('Status of B1'), {
			target: { value: 'not-in-use' }
		});
		expect(state.current.items[0].status).toBe('not-in-use');
		await fireEvent.change(screen.getByLabelText('Voltage of B1'), { target: { value: '' } });
		expect(state.current.items[0].voltage).toBeNull();
	});

	it('adds a battery with the next name', async () => {
		const { state } = setup([battery('B1'), battery('B2')]);
		await fireEvent.click(screen.getByRole('button', { name: 'Add battery' }));
		expect(state.current.items.map((item) => item.name)).toEqual(['B1', 'B2', 'B3']);
	});

	it('asks twice before removing a battery', async () => {
		const { state, refresh } = setup([battery('B1'), battery('B2')]);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove B1' }));
		expect(state.current.items).toHaveLength(2);
		await refresh();
		await fireEvent.click(screen.getByRole('button', { name: 'Confirm removing B1' }));
		expect(state.current.items.map((item) => item.name)).toEqual(['B2']);
	});

	it('explains an empty log', () => {
		setup([]);
		expect(screen.getByText('No batteries yet.')).toBeInTheDocument();
	});

	it('shows a read only copy as text', () => {
		render(BatteryLog, {
			props: { batteries: { items: [battery('B4', { used: ['Q5', 'Q14'], note: 'Dropped low' })] } }
		});
		expect(screen.queryByRole('textbox')).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText('Charged, use next')).toBeInTheDocument();
		expect(screen.getByText('Q5, Q14')).toBeInTheDocument();
		expect(screen.getByText('Dropped low')).toBeInTheDocument();
	});
});
