import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { match, ranking } from '#lib/components/team/fixtures.ts';
import { FOLLOW_KEY, follows } from '#lib/components/follow/follow.svelte.ts';
import type { FollowedTeam } from './followed.ts';
import FollowedTeams from './FollowedTeams.svelte';

const responses = new Map<string, unknown>();
const requested: string[] = [];

const live: FollowedTeam = {
	number: 26670,
	name: 'SCA Iron Eagles',
	found: true,
	event: {
		code: 'USAZGIQ',
		name: 'Roadrunner - Gilbert Qualifier',
		start: '2026-11-14',
		end: '2026-11-14',
		timezone: 'America/Phoenix',
		reason: 'today'
	},
	standing: { rank: 9, wins: 2, losses: 1, ties: 0 },
	opr: 80,
	worldRank: 50,
	rated: 3926
};

const quiet: FollowedTeam = {
	number: 3747,
	name: 'The Hive',
	found: true,
	event: {
		code: 'USMTBUQ',
		name: 'Montana Qualifier - Butte MT-Tech',
		start: '2026-11-20',
		end: '2026-11-21',
		timezone: 'America/Denver',
		reason: 'next'
	},
	standing: null,
	opr: 87.25,
	worldRank: 2284,
	rated: 3926
};

const rankings = Array.from({ length: 27 }, (_, index) =>
	ranking(index + 1, index === 6 ? 26670 : 1000 + index, 3, 0)
);

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-11-14T20:41:00Z'));
	localStorage.clear();
	follows.teams = [];
	responses.clear();
	requested.length = 0;
	responses.set('/api/following?teams=3747,26670', { teams: [quiet, live] });
	responses.set('/api/following?teams=26670', { teams: [live] });
	responses.set('/api/following?teams=3747', { teams: [quiet] });
	responses.set('/api/events/USAZGIQ/lite', {
		event: { timezone: 'America/Phoenix' },
		matches: [match(26, [26670, 1], [2, 3], '2026-11-14T20:58:00Z', false)],
		rankings
	});
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			requested.push(url);
			const body = responses.get(url);
			return body === undefined ? new Response('missing', { status: 404 }) : Response.json(body);
		})
	);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function cardFor(team: number): HTMLElement {
	const link = screen.getByRole('link', { name: new RegExp(`^${team}`) });
	return link.closest('li') as HTMLElement;
}

describe('followed teams', () => {
	it('offers a team search right there when there are none', async () => {
		render(FollowedTeams);
		expect(
			await screen.findByRole('searchbox', { name: 'Team number or name' })
		).toBeInTheDocument();
		expect(requested).toEqual([]);
	});

	it('follows a team from the search and shows it in the list', async () => {
		responses.set('/api/search?q=26670', {
			teams: [{ number: 26670, name: 'SCA Iron Eagles', city: 'Gilbert', state: 'AZ' }],
			events: [],
			lead: 'teams'
		});
		render(FollowedTeams);
		await fireEvent.input(await screen.findByRole('searchbox', { name: 'Team number or name' }), {
			target: { value: '26670' }
		});
		await fireEvent.click(await screen.findByRole('button', { name: 'Follow 26670' }));
		expect(JSON.parse(localStorage.getItem(FOLLOW_KEY) ?? '[]')).toEqual([26670]);
		expect(await screen.findByRole('link', { name: 'Pit screen' })).toHaveAttribute(
			'href',
			'/26670'
		);
		expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
	});

	it('says when no team matches the search', async () => {
		responses.set('/api/search?q=zzzz', { teams: [], events: [], lead: 'teams' });
		render(FollowedTeams);
		await fireEvent.input(await screen.findByRole('searchbox', { name: 'Team number or name' }), {
			target: { value: 'zzzz' }
		});
		expect(await screen.findByText('No teams match "zzzz".')).toBeInTheDocument();
	});

	it('loads every team in one request and the live event once', async () => {
		localStorage.setItem(FOLLOW_KEY, '[3747,26670]');
		render(FollowedTeams);
		await screen.findByText('Q26');
		expect(requested).toEqual(['/api/following?teams=3747,26670', '/api/events/USAZGIQ/lite']);
		const cards = screen.getAllByRole('listitem');
		expect(within(cards[0]).getByText('26670')).toBeInTheDocument();
		expect(within(cards[1]).getByText('3747')).toBeInTheDocument();
	});

	it('shows rank, next match and time for a team at an event today', async () => {
		localStorage.setItem(FOLLOW_KEY, '[26670]');
		render(FollowedTeams);
		await screen.findByText('Q26');
		const card = cardFor(26670);
		expect(within(card).getByRole('link', { name: 'Pit screen' })).toHaveAttribute(
			'href',
			'/26670'
		);
		expect(
			within(card).getByRole('link', { name: 'Roadrunner - Gilbert Qualifier' })
		).toHaveAttribute('href', '/events/USAZGIQ');
		expect(within(card).getByRole('link', { name: 'Q26' })).toHaveAttribute(
			'href',
			'/events/USAZGIQ/matches/q26'
		);
		expect(within(card).getByText('red')).toBeInTheDocument();
		expect(within(card).getByText(/^1:58\sPM$/)).toBeInTheDocument();
		expect(within(card).getByText('7th')).toBeInTheDocument();
		expect(within(card).getByText('of 27 · 3-0-0')).toBeInTheDocument();
		expect(within(card).getByText('No matches played')).toBeInTheDocument();
	});

	it('shows the next event and season OPR for a team that is not playing today', async () => {
		localStorage.setItem(FOLLOW_KEY, '[3747]');
		render(FollowedTeams);
		await screen.findByText('Montana Qualifier - Butte MT-Tech');
		const card = cardFor(3747);
		expect(within(card).getByText('Nov 20')).toBeInTheDocument();
		expect(within(card).getByText('87.3')).toBeInTheDocument();
		expect(within(card).getByText('· 2,284th of 3,926 worldwide')).toBeInTheDocument();
		expect(requested).toEqual(['/api/following?teams=3747']);
	});

	it('falls back to the event rank when the live event cannot be loaded', async () => {
		localStorage.setItem(FOLLOW_KEY, '[26670]');
		responses.delete('/api/events/USAZGIQ/lite');
		render(FollowedTeams);
		expect(await screen.findByText('Unavailable')).toBeInTheDocument();
		expect(within(cardFor(26670)).getByText('9th')).toBeInTheDocument();
	});

	it('says so when the teams cannot be loaded', async () => {
		localStorage.setItem(FOLLOW_KEY, '[99999]');
		render(FollowedTeams);
		expect(await screen.findByText('Could not load this team')).toBeInTheDocument();
	});

	it('lists a limited number of teams and says how many are hidden', async () => {
		const numbers = Array.from({ length: 14 }, (_, index) => 100 + index);
		localStorage.setItem(FOLLOW_KEY, JSON.stringify(numbers));
		render(FollowedTeams);
		await screen.findByText('Showing 12 of 14 followed teams.');
		expect(screen.getAllByRole('listitem')).toHaveLength(12);
		expect(requested[0]).toBe(`/api/following?teams=${numbers.slice(0, 12).join(',')}`);
	});
});
