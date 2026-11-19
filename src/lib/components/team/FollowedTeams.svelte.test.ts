import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MISSING } from '#lib/format/index.ts';
import { eventSummary, match, ranking } from './fixtures.ts';
import { FOLLOW_KEY, follows } from './follow.svelte.ts';
import FollowedTeams from './FollowedTeams.svelte';

const responses = new Map<string, unknown>();
const requested: string[] = [];

function season(number: number, name: string, events: unknown[]) {
	return {
		team: { number, name, city: 'Phoenix', state: 'AZ', country: 'USA', rookieYear: 2024 },
		events,
		quickStats: null,
		previousQuickStats: null,
		fetchedAt: 0,
		stale: false
	};
}

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
	responses.set(
		'/api/teams/26670',
		season(26670, 'SCA Iron Eagles', [{ event: eventSummary(), stats: null, awards: [] }])
	);
	responses.set('/api/events/USAZGIQ', {
		event: { timezone: 'America/Phoenix' },
		matches: [match(26, [26670, 1], [2, 3], '2026-11-14T20:58:00Z', false)],
		rankings
	});
	responses.set(
		'/api/teams/3747',
		season(3747, 'The Hive', [
			{
				event: eventSummary({
					code: 'USMTBUQ',
					name: 'Montana Qualifier - Butte MT-Tech',
					start: '2026-11-20',
					end: '2026-11-21'
				}),
				stats: null,
				awards: []
			}
		])
	);
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

function rowFor(team: number): HTMLElement {
	const link = screen.getByRole('link', { name: new RegExp(`^${team}`) });
	return link.closest('tr') as HTMLElement;
}

describe('followed teams', () => {
	it('suggests following a team when there are none', async () => {
		render(FollowedTeams);
		expect(
			await screen.findByText('Follow a team from its page and it will show up here.')
		).toBeInTheDocument();
		expect(requested).toEqual([]);
	});

	it('shows the current event, next match and rank for a followed team', async () => {
		localStorage.setItem(FOLLOW_KEY, '[26670]');
		render(FollowedTeams);
		await screen.findByText('Roadrunner - Gilbert Qualifier');
		const row = rowFor(26670);
		expect(within(row).getByText('26670')).toBeInTheDocument();
		expect(within(row).getByText('SCA Iron Eagles')).toBeInTheDocument();
		expect(
			within(row).getByRole('link', { name: 'Roadrunner - Gilbert Qualifier' })
		).toHaveAttribute('href', '/events/USAZGIQ');
		expect(within(row).getByText('Today')).toBeInTheDocument();
		expect(within(row).getByText('Q26 at 1:58 PM, red')).toBeInTheDocument();
		expect(within(row).getByText('7 of 27, 3-0-0')).toBeInTheDocument();
		expect(requested).toEqual(['/api/teams/26670', '/api/events/USAZGIQ']);
	});

	it('shows the next event for a team that is not playing today', async () => {
		localStorage.setItem(FOLLOW_KEY, '[3747]');
		render(FollowedTeams);
		await screen.findByText('Montana Qualifier - Butte MT-Tech');
		const row = rowFor(3747);
		expect(within(row).getByText('Starts Nov 20')).toBeInTheDocument();
		expect(requested).toEqual(['/api/teams/3747']);
	});

	it('says so when a team cannot be loaded', async () => {
		localStorage.setItem(FOLLOW_KEY, '[26670,99999]');
		render(FollowedTeams);
		expect(await screen.findByText('Could not load this team')).toBeInTheDocument();
		expect(await screen.findByText('Roadrunner - Gilbert Qualifier')).toBeInTheDocument();
	});

	it('still shows the team when the event details fail', async () => {
		localStorage.setItem(FOLLOW_KEY, '[26670]');
		responses.delete('/api/events/USAZGIQ');
		render(FollowedTeams);
		await screen.findByText('Roadrunner - Gilbert Qualifier');
		expect(within(rowFor(26670)).getAllByText(MISSING)).toHaveLength(2);
	});

	it('lists a limited number of teams and says how many are hidden', async () => {
		const numbers = Array.from({ length: 14 }, (_, index) => 100 + index);
		localStorage.setItem(FOLLOW_KEY, JSON.stringify(numbers));
		render(FollowedTeams);
		await screen.findByText('Showing 12 of 14 followed teams.');
		expect(screen.getAllByRole('row')).toHaveLength(13);
	});
});
