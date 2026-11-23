import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { follows } from '#lib/components/follow/follow.svelte.ts';
import type { HomeEvent, TodayEvent } from '#lib/components/home/home.ts';
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

const today: TodayEvent[] = [
	{
		code: 'USAZGIQ',
		name: 'Roadrunner - Gilbert Qualifier',
		type: 'Qualifier',
		place: 'Gilbert, AZ',
		dates: 'Today',
		status: 'Q23 of 40',
		state: 'live',
		leader: { team: 26670, name: 'SCA Iron Eagles' },
		leaderLabel: 'Leading'
	},
	{
		code: 'USAZTUQ',
		name: 'Tucson Qualifier',
		type: 'Qualifier',
		place: 'Tucson, AZ',
		dates: 'Today',
		status: 'Not started',
		state: 'waiting',
		leader: null,
		leaderLabel: 'Top seed'
	}
];

const week: HomeEvent[] = [
	{
		code: 'USMTBUQ',
		name: 'Montana Qualifier - Butte MT-Tech',
		type: 'Qualifier',
		place: 'Butte, MT',
		dates: 'Nov 20–21',
		status: 'In 2 days'
	}
];

function show(data: {
	today: TodayEvent[] | null;
	week: HomeEvent[] | null;
	highlights?: unknown;
}) {
	return render(Page, { props: { data } as never });
}

describe('home page', () => {
	it('opens the search dialog from the search field', async () => {
		show({ today, week });
		await fireEvent.click(screen.getByRole('button', { name: /Search teams and events/ }));
		expect(searchDialog.open).toBe(true);
	});

	it('lists events today with their progress and leader', () => {
		show({ today, week });
		expect(screen.getByText('1 of 2 running now')).toBeInTheDocument();
		const table = screen.getByRole('table', { name: 'Events running today' });
		const [first, second] = within(table).getAllByRole('row').slice(1);
		const cells = (row: HTMLElement) =>
			[...row.querySelectorAll('td')].map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim());
		expect(cells(first)).toEqual([
			'Roadrunner - Gilbert Qualifier Gilbert, AZ · Qualifier',
			'Gilbert, AZ',
			'Today',
			'Q23 of 40 Leading 26670',
			'Leading 26670 SCA Iron Eagles'
		]);
		expect(cells(second)[3]).toBe('Not started');
		expect(within(first).getAllByRole('link', { name: /26670/ })[0]).toHaveAttribute(
			'href',
			'/teams/26670'
		);
	});

	it('leaves out the leader column when no event has one', () => {
		show({ today: [today[1]], week });
		const table = screen.getByRole('table', { name: 'Events running today' });
		expect(within(table).queryByRole('columnheader', { name: 'Leader' })).not.toBeInTheDocument();
		expect(screen.queryByText(/running now/)).not.toBeInTheDocument();
	});

	it('lists events starting this week with when they start', () => {
		show({ today, week });
		const table = screen.getByRole('table', { name: 'Events starting in the next 7 days' });
		const row = within(table).getAllByRole('row')[1];
		expect([...row.querySelectorAll('td')].map((cell) => cell.textContent)).toEqual([
			'Montana Qualifier - Butte MT-Tech Butte, MT',
			'Butte, MT',
			'Qualifier',
			'Nov 20–21',
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

	it('offers a team search to follow when none are followed', async () => {
		show({ today, week });
		expect(await screen.findByRole('heading', { name: 'Your teams' })).toBeInTheDocument();
		expect(screen.getByRole('searchbox', { name: 'Team number or name' })).toBeInTheDocument();
	});

	it('introduces the site and its standout tools to a first-time visitor', async () => {
		show({ today, week });
		const intro = await screen.findByRole('region', { name: 'What PitStop does' });
		const links = within(intro).getAllByRole('link');
		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			'#pit',
			'/w',
			'/advancement',
			'/events/strength'
		]);
		expect(document.getElementById('pit')).not.toBeNull();
	});

	it('keeps the intro hidden once dismissed', async () => {
		show({ today, week });
		const intro = await screen.findByRole('region', { name: 'What PitStop does' });
		await fireEvent.click(within(intro).getByRole('button', { name: 'Hide' }));
		expect(screen.queryByRole('region', { name: 'What PitStop does' })).not.toBeInTheDocument();
		cleanup();
		show({ today, week });
		await screen.findByRole('heading', { name: 'Your teams' });
		expect(screen.queryByRole('region', { name: 'What PitStop does' })).not.toBeInTheDocument();
	});

	it('hides the intro for visitors who follow a team', async () => {
		localStorage.setItem('ps-follow', '[26670]');
		show({ today, week });
		await screen.findByRole('heading', { name: 'Your teams' });
		await vi.waitFor(() =>
			expect(screen.queryByRole('region', { name: 'What PitStop does' })).not.toBeInTheDocument()
		);
		expect(localStorage.getItem('ps-hints')).toBe('["intro"]');
	});

	it('shows the best matches with links to each match', () => {
		const item = {
			event: 'USAZGIQ',
			key: 'p7',
			label: 'M7',
			red: [13684, 10016],
			blue: [1, 2],
			redScore: 288,
			blueScore: 155,
			winner: 'red',
			chance: null
		};
		show({
			today,
			week,
			highlights: {
				range: 'today',
				highest: [item],
				closest: [{ ...item, key: 'q3', label: 'Q3', blueScore: 286 }],
				upsets: [{ ...item, key: 'q9', label: 'Q9', chance: 0.18 }],
				names: { teams: {}, events: { USAZGIQ: 'Gilbert Qualifier' } }
			}
		});
		expect(screen.getByRole('heading', { name: 'Best matches today' })).toBeInTheDocument();
		const highest = screen.getByRole('list', { name: 'Highest scores' });
		expect(within(highest).getByRole('link')).toHaveAttribute('href', '/events/USAZGIQ/matches/p7');
		expect(within(highest).getByRole('link')).toHaveTextContent('288–155 M7 · Gilbert Qualifier');
		expect(screen.getByText('Won by 2')).toBeInTheDocument();
		expect(screen.getByText('Won with a 18% chance')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'More records' })).toHaveAttribute(
			'href',
			'/records?range=7'
		);
	});

	it('leaves out the best matches until the season is loaded', () => {
		show({ today, week, highlights: null });
		expect(screen.queryByText(/Best matches/)).not.toBeInTheDocument();
	});
});
