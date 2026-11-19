import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Tabs from './Tabs.svelte';

afterEach(() => {
	cleanup();
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
});
