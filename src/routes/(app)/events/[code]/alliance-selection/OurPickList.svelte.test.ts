import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeviceStore } from '#lib/workspace/device-store.ts';
import type { Recent } from '#lib/workspace/recents.ts';
import OurPickList from './OurPickList.svelte';

const loading = createRawSnippet(() => ({ render: () => '<p>Loading list</p>' }));

async function saved(teamNumber: number): Promise<Recent> {
	const meta = await createDeviceStore(localStorage).create({ teamNumber });
	return { code: meta.code, teamNumber, kind: 'device', openedAt: 1 };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe('OurPickList', () => {
	it('shows the saved pick list and reports its marks', async () => {
		const recent = await saved(3747);
		const onmarks = vi.fn();
		render(OurPickList, {
			shared: false,
			recents: [recent],
			chosen: recent.code,
			labels: new Map(),
			stats: new Map(),
			loading,
			onmarks
		});
		expect(screen.getByText('Loading list')).toBeInTheDocument();
		expect(await screen.findByText('Saved on this device.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Edit pick list' })).toHaveAttribute(
			'href',
			`/w/${recent.code}/picklist`
		);
		expect(screen.queryByLabelText('Workspace')).not.toBeInTheDocument();
		expect(onmarks).toHaveBeenLastCalledWith(expect.any(Map));
	});

	it('lets the visitor switch between saved workspaces', async () => {
		const first = await saved(3747);
		const second = await saved(724);
		render(OurPickList, {
			shared: false,
			recents: [first, second],
			chosen: first.code,
			labels: new Map(),
			stats: new Map(),
			loading,
			onmarks: () => {}
		});
		const select = await screen.findByLabelText('Workspace');
		expect(select).toHaveValue(first.code);
		expect(screen.getByRole('option', { name: /Team 724/ })).toBeInTheDocument();
	});
});
