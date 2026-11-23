import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TeamBadges from './TeamBadges.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function clipboard(writeText: () => Promise<void>) {
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

async function openBadges() {
	render(TeamBadges, { props: { number: 26670, name: 'SCA Iron Eagles' } });
	const summary = screen.getByText('Badges for a team website or README');
	const details = summary.closest('details') as HTMLDetailsElement;
	details.open = true;
	await fireEvent(details, new Event('toggle'));
	await screen.findByLabelText('Badge');
	return details;
}

describe('team badges', () => {
	it('stays closed and loads no images until opened', () => {
		render(TeamBadges, { props: { number: 26670, name: 'SCA Iron Eagles' } });
		expect(
			screen.getByText('Badges for a team website or README').closest('details')
		).not.toHaveAttribute('open');
		expect(screen.queryAllByRole('img')).toHaveLength(0);
	});

	it('previews light and dark badges and switches kind', async () => {
		await openBadges();
		const images = screen.getAllByRole('img');
		expect(images.map((image) => image.getAttribute('src'))).toEqual([
			'/badge/26670.svg',
			'/badge/26670.svg?theme=dark'
		]);
		expect(images[0]).toHaveAttribute('alt', 'FTC team 26670 SCA Iron Eagles on PitStop');
		await fireEvent.change(screen.getByLabelText('Badge'), { target: { value: 'card' } });
		expect(screen.getAllByRole('img')[1]).toHaveAttribute(
			'src',
			'/badge/26670/card.svg?theme=dark'
		);
		expect(screen.getByText(/card\.svg\)\]\(/)).toBeInTheDocument();
	});

	it('copies a snippet and says so', async () => {
		const writeText = vi.fn(async () => {});
		clipboard(writeText);
		await openBadges();
		await fireEvent.click(screen.getByRole('button', { name: 'Copy Markdown' }));
		expect(writeText).toHaveBeenCalledWith(
			expect.stringMatching(/^\[!\[FTC team 26670 .*\/teams\/26670\)$/)
		);
		expect(await screen.findByText('Copied')).toBeInTheDocument();
	});

	it('selects the snippet when the clipboard is blocked', async () => {
		clipboard(async () => {
			throw new Error('blocked');
		});
		await openBadges();
		await fireEvent.click(screen.getByRole('button', { name: 'Copy Image URL' }));
		expect(await screen.findByText(/Press Ctrl\+C/)).toBeInTheDocument();
		expect(window.getSelection()?.toString()).toMatch(/\/badge\/26670\.svg$/);
	});
});
