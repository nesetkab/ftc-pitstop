import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Tabs from './Tabs.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const tabs = [
	{ href: '/events/USAZGIQ', label: 'Overview' },
	{ href: '/events/USAZGIQ/rankings', label: 'Rankings' },
	{ href: '/events/USAZGIQ/schedule', label: 'Schedule' }
];

describe('Tabs', () => {
	it('marks only the current tab', () => {
		render(Tabs, { props: { tabs, current: '/events/USAZGIQ/rankings' } });
		expect(screen.getByRole('link', { name: 'Rankings' })).toHaveAttribute('aria-current', 'page');
		expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
		expect(screen.getByRole('link', { name: 'Schedule' })).not.toHaveAttribute('aria-current');
	});

	it('ignores trailing slashes and query strings', () => {
		render(Tabs, { props: { tabs, current: '/events/USAZGIQ/schedule/' } });
		expect(screen.getByRole('link', { name: 'Schedule' })).toHaveAttribute('aria-current', 'page');
	});

	it('does not treat a parent path as current', () => {
		render(Tabs, { props: { tabs, current: '/events/USAZGIQ/matches/q26' } });
		expect(
			screen.queryAllByRole('link').filter((link) => link.hasAttribute('aria-current'))
		).toEqual([]);
	});

	it('names the navigation', () => {
		render(Tabs, { props: { tabs, current: '/events/USAZGIQ', label: 'Event' } });
		expect(screen.getByRole('navigation', { name: 'Event' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
			'href',
			'/events/USAZGIQ'
		);
	});

	it('offers a way to the hidden tabs when the row overflows', async () => {
		vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
		vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
		render(Tabs, { props: { tabs, current: '/events/USAZGIQ', label: 'Event' } });
		expect(await screen.findByRole('button', { name: 'Scroll event forward' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Scroll event back' })).toBeNull();
	});

	it('shows no scroll buttons when every tab fits', () => {
		render(Tabs, { props: { tabs, current: '/events/USAZGIQ', label: 'Event' } });
		expect(screen.queryByRole('button')).toBeNull();
	});
});
