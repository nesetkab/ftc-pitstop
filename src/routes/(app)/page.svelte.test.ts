import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { follows } from '#lib/components/team/follow.svelte.ts';
import type { HomeEvent } from '#lib/components/team/home.ts';
import { searchDialog } from '#lib/ui/search.svelte.ts';
import Page from './+page.svelte';

const navigation = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => navigation);

beforeEach(() => {
	localStorage.clear();
	follows.teams = [];
	searchDialog.open = false;
	navigation.goto.mockReset();
});

afterEach(() => {
	cleanup();
});

const today: HomeEvent[] = [
	{
		code: 'USAZGIQ',
		name: 'Roadrunner - Gilbert Qualifier',
		type: 'Qualifier',
		place: 'Gilbert, AZ',
		dates: 'Today',
		status: 'Matches posted'
	}
];

const week: HomeEvent[] = [
	{
		code: 'USMTBUQ',
		name: 'Montana Qualifier - Butte MT-Tech',
		type: 'Qualifier',
		place: 'Butte, MT',
		dates: 'Nov 20 and 21',
		status: 'In 2 days'
	}
];

function show(data: { today: HomeEvent[] | null; week: HomeEvent[] | null }) {
	return render(Page, { props: { data } as never });
}

describe('home page', () => {
	it('opens the search dialog from the search field', async () => {
		show({ today, week });
		await fireEvent.click(screen.getByRole('button', { name: /Search teams and events/ }));
		expect(searchDialog.open).toBe(true);
	});

	it('lists events today with their status', () => {
		show({ today, week });
		const table = screen.getByRole('table', { name: 'Events running today' });
		const row = within(table).getAllByRole('row')[1];
		expect([...row.querySelectorAll('td')].map((cell) => cell.textContent)).toEqual([
			'Roadrunner - Gilbert Qualifier Gilbert, AZ',
			'Gilbert, AZ',
			'Qualifier',
			'Today',
			'Matches posted'
		]);
	});

	it('lists events starting this week with when they start', () => {
		show({ today, week });
		const table = screen.getByRole('table', { name: 'Events starting in the next 7 days' });
		const row = within(table).getAllByRole('row')[1];
		expect([...row.querySelectorAll('td')].map((cell) => cell.textContent)).toEqual([
			'Montana Qualifier - Butte MT-Tech Butte, MT',
			'Butte, MT',
			'Qualifier',
			'Nov 20 and 21',
			'In 2 days'
		]);
		expect(screen.getByRole('link', { name: 'All events this season' })).toHaveAttribute(
			'href',
			'/events'
		);
	});

	it('says plainly when there is nothing to list', () => {
		show({ today: [], week: [] });
		expect(screen.getByText('No events are running today.')).toBeInTheDocument();
		expect(screen.getByText('No events start in the next 7 days.')).toBeInTheDocument();
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
	});

	it('says when the lists could not be loaded', () => {
		show({ today: null, week: null });
		expect(screen.getByText("Today's events could not be loaded.")).toBeInTheDocument();
		expect(screen.getByText("This week's events could not be loaded.")).toBeInTheDocument();
	});

	it('has the pit display address with a team number field', () => {
		show({ today, week });
		expect(screen.getByText('Open the pit display for your team')).toBeInTheDocument();
		expect(screen.getByRole('textbox', { name: 'Team number' })).toBeInTheDocument();
		expect(screen.getByText('ftcpitstop.com/')).toBeInTheDocument();
	});

	it('suggests following a team when none are followed', async () => {
		show({ today, week });
		expect(await screen.findByRole('heading', { name: 'Your teams' })).toBeInTheDocument();
		expect(
			screen.getByText('Follow a team from its page and it will show up here.')
		).toBeInTheDocument();
	});
});
