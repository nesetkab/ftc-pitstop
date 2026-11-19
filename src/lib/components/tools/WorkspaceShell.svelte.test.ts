import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WorkspaceShell from '#lib/components/tools/WorkspaceShell.svelte';
import { createDeviceStore } from '#lib/workspace/device-store.ts';
import { readRecents } from '#lib/workspace/recents.ts';

const children = createRawSnippet(() => ({ render: () => '<p>Tool content</p>' }));

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	cleanup();
});

describe('workspace shell', () => {
	it('shows the team, the join code and where the data is saved', async () => {
		const { code } = await createDeviceStore(localStorage).create({ teamNumber: 14624 });
		render(WorkspaceShell, { props: { code, shared: false, children } });
		expect(screen.getByRole('status')).toHaveTextContent('Loading the workspace.');
		expect(await screen.findByText('Tool content')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Team tools' })).toBeInTheDocument();
		expect(
			screen.getByText(`Team 14624. Join code ${code.slice(0, 3)}-${code.slice(3)}.`)
		).toBeInTheDocument();
		expect(screen.getByText('Saved on this device.')).toBeInTheDocument();
	});

	it('links the four tools', async () => {
		const { code } = await createDeviceStore(localStorage).create({ teamNumber: 14624 });
		render(WorkspaceShell, { props: { code, shared: false, children } });
		await screen.findByText('Tool content');
		const nav = screen.getByRole('navigation', { name: 'Team tools' });
		const links = Array.from(nav.querySelectorAll('a')).map((link) => [
			link.textContent?.trim(),
			link.getAttribute('href')
		]);
		expect(links).toEqual([
			['Pick list', `/w/${code}/picklist`],
			['Batteries', `/w/${code}/batteries`],
			['Checklist', `/w/${code}/checklist`],
			['Strategy board', `/w/${code}/board`]
		]);
	});

	it('remembers the workspace on this device', async () => {
		const { code } = await createDeviceStore(localStorage).create({ teamNumber: 14624 });
		render(WorkspaceShell, { props: { code, shared: false, children } });
		await screen.findByText('Tool content');
		expect(readRecents(localStorage)[0]).toMatchObject({ code, teamNumber: 14624, kind: 'device' });
	});

	it('saves the next match label with the checklist', async () => {
		const store = createDeviceStore(localStorage);
		const { code } = await store.create({ teamNumber: 14624 });
		render(WorkspaceShell, { props: { code, shared: false, children } });
		await screen.findByText('Tool content');
		await fireEvent.change(screen.getByLabelText('Next match'), { target: { value: 'Q26' } });
		await waitFor(async () =>
			expect((await store.load(code))?.docs.checklist?.data.match).toBe('Q26')
		);
	});

	it('says so when no workspace uses the code', async () => {
		render(WorkspaceShell, { props: { code: 'ZZZZZZ', shared: false, children } });
		expect(await screen.findByText('No workspace uses the code ZZZ-ZZZ.')).toBeInTheDocument();
		expect(screen.queryByText('Tool content')).toBeNull();
		expect(screen.getByRole('link', { name: 'Team workspaces' })).toHaveAttribute('href', '/w');
	});
});
