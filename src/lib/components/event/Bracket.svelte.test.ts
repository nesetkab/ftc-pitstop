import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Bracket from './Bracket.svelte';
import {
	allianceStatus,
	buildBracket,
	finalsStatus,
	playoffRecords,
	type BracketView
} from './bracket.ts';
import { fixtureBundle, unplay } from './test-fixtures.ts';

afterEach(() => {
	cleanup();
});

function bracketOf(code: string, keep?: (series: number) => boolean) {
	const bundle = fixtureBundle(code);
	const matches = keep
		? bundle.matches.filter((match) => match.level === 'qual' || keep(match.series))
		: bundle.matches;
	return { bundle, bracket: buildBracket(bundle.alliances, matches) as BracketView };
}

function layout(view: BracketView) {
	const column = (rounds: BracketView['upper']) =>
		rounds.map((round) =>
			round.map((match) => `${match.label} ${match.red.seed ?? '?'}v${match.blue.seed ?? '?'}`)
		);
	return { upper: column(view.upper), lower: column(view.lower) };
}

function show(code: string, view: BracketView) {
	render(Bracket, { props: { code, bracket: view, timezone: 'UTC' } });
}

describe('bracket layout', () => {
	it('lays out the 6 alliance double elimination bracket', () => {
		const { bracket } = bracketOf('USAZGIQ');
		expect(bracket.size).toBe(6);
		expect(layout(bracket)).toEqual({
			upper: [['M1 4v5', 'M2 3v6'], ['M3 1v5', 'M4 2v3'], ['M7 1v2']],
			lower: [['M5 5v6', 'M6 3v4'], ['M8 3v6'], ['M9 1v3']]
		});
		expect(bracket.finals.games.map((game) => game.label)).toEqual(['M10']);
		expect(bracket.finals.alliances.map((side) => side.seed)).toEqual([2, 1]);
		expect(bracket.champion).toBe(2);
	});

	it('plays the second final when the lower bracket wins the first', () => {
		const { bracket } = bracketOf('USMISOQ');
		expect(bracket.finals.games.map((game) => [game.label, game.winner])).toEqual([
			['M10', 1],
			['M11', 1]
		]);
		expect(bracket.champion).toBe(3);
	});

	it('lays out the 4 alliance bracket', () => {
		const { bracket } = bracketOf('UZTAQ1');
		expect(bracket.size).toBe(4);
		expect(layout(bracket)).toEqual({
			upper: [['M1 1v4', 'M2 2v3'], ['M4 1v3']],
			lower: [['M3 4v2'], ['M5 3v4']]
		});
		expect(bracket.finals.games.map((game) => game.label)).toEqual(['M6']);
		expect(bracket.champion).toBe(1);
	});

	it('shows a 2 alliance event as a best of three final', () => {
		const { bracket } = bracketOf('USALATQ');
		expect(bracket.size).toBe(2);
		expect(bracket.upper).toEqual([]);
		expect(bracket.lower).toEqual([]);
		expect(bracket.finals.games.map((game) => [game.label, game.scores])).toEqual([
			['F1', [68, 37]],
			['F2', [59, 38]]
		]);
		expect(bracket.finals.alliances.map((side) => [side.seed, side.wins, side.champion])).toEqual([
			[1, 2, true],
			[2, 0, false]
		]);
	});

	it('fills matches that have not been scheduled from earlier results', () => {
		const { bracket } = bracketOf('USAZGIQ', (series) => series <= 4);
		const m7 = bracket.upper[2][0];
		expect(m7).toMatchObject({ key: null, played: false });
		expect([m7.red.seed, m7.blue.seed]).toEqual([1, 2]);
		const m9 = bracket.lower[2][0];
		expect(m9.red).toMatchObject({ seed: null, source: 'Loser of M7', teams: [] });
		expect(bracket.finals.games.map((game) => [game.label, game.ifNeeded])).toEqual([
			['M10', false],
			['M11', true]
		]);
		expect(bracket.finals.alliances[1].source).toBe('Winner of M9');
		expect(bracket.champion).toBeNull();
	});

	it('counts playoff records by alliance', () => {
		const bundle = fixtureBundle('USAZGIQ');
		const records = playoffRecords(bundle.alliances, bundle.matches);
		expect(records.get(2)).toEqual({ wins: 3, losses: 0, ties: 0 });
		expect(records.get(1)).toEqual({ wins: 2, losses: 2, ties: 0 });
	});
});

describe('playoff status', () => {
	const seeds = [1, 2, 3, 4, 5, 6];

	it('names the winner, the finalist and where each other alliance went out', () => {
		const { bracket } = bracketOf('USAZGIQ');
		const status = allianceStatus(bracket, seeds);
		expect(status.get(2)).toBe('Won the event');
		expect(status.get(1)).toBe('Finalist');
		expect([3, 4, 5, 6].map((seed) => status.get(seed))).toEqual(
			[3, 4, 5, 6].map(() => expect.stringMatching(/^Out after M\d+$/))
		);
		expect(finalsStatus(bracket)).toBeNull();
	});

	it('keeps alliances that are still alive in their bracket', () => {
		const { bracket } = bracketOf('USAZGIQ', (series) => series <= 4);
		const status = allianceStatus(bracket, seeds);
		expect(seeds.map((seed) => status.get(seed))).toEqual([
			'Upper bracket',
			'Upper bracket',
			'Lower bracket',
			'Lower bracket',
			'Lower bracket',
			'Lower bracket'
		]);
		expect(finalsStatus(bracket)).toBeNull();
	});

	it('says nothing before the first playoff match', () => {
		const { bracket } = bracketOf('USAZGIQ', () => false);
		expect(allianceStatus(bracket, seeds).size).toBe(0);
	});

	it('explains a second final after the lower bracket wins the first', () => {
		const bundle = unplay(fixtureBundle('USMISOQ'), (match) => match.series === 11);
		const bracket = buildBracket(bundle.alliances, bundle.matches) as BracketView;
		expect(finalsStatus(bracket)).toBe('Alliance 3 won M10, so M11 decides the event.');
		const status = allianceStatus(bracket, seeds);
		expect(status.get(3)).toBe('In the finals');
	});

	it('gives the series score in a best of three final', () => {
		const bundle = unplay(fixtureBundle('USALATQ'), (match) => match.key === 'p2');
		const bracket = buildBracket(bundle.alliances, bundle.matches) as BracketView;
		expect(finalsStatus(bracket)).toBe('Alliance 1 leads the finals 1–0.');
		expect(allianceStatus(bracket, [1, 2])).toEqual(
			new Map([
				[1, 'In the finals'],
				[2, 'In the finals']
			])
		);
	});
});

describe('Bracket', () => {
	it('draws upper and lower brackets with scores and the finals', () => {
		const { bracket } = bracketOf('USAZGIQ');
		show('USAZGIQ', bracket);
		const upper = screen.getByRole('region', { name: 'Upper bracket' });
		expect(
			within(upper)
				.getAllByText(/^Round/)
				.map((node) => node.textContent)
		).toEqual(['Round 1', 'Round 2', 'Round 4']);
		const m3 = within(upper).getByRole('link', { name: 'M3' });
		expect(m3).toHaveAttribute('href', '/events/USAZGIQ/matches/p3');
		const lower = screen.getByRole('region', { name: 'Lower bracket' });
		expect(
			within(lower)
				.getAllByRole('link')
				.map((link) => link.textContent?.trim())
		).toEqual(['M5', 'M6', 'M8', 'M9']);
		const finals = screen.getByRole('region', { name: 'Finals' });
		expect(within(finals).getByRole('link', { name: 'M10' })).toBeInTheDocument();
		expect(within(finals).getAllByRole('row')[1]).toHaveTextContent('178');
		expect(screen.queryByText(/won the event/)).toBeNull();
	});

	it('reads each match with its alliances and winner, not only by color', () => {
		const { bracket } = bracketOf('USAZGIQ');
		show('USAZGIQ', bracket);
		const upper = screen.getByRole('region', { name: 'Upper bracket' });
		expect(
			within(upper)
				.getAllByRole('heading', { level: 4 })
				.map((node) => node.textContent)
		).toEqual(['Round 1', 'Round 2', 'Round 4']);
		const m1 = within(upper).getByRole('link', { name: 'M1' }).closest('li')!;
		const sides = [...m1.querySelectorAll('.slot')].map((slot) =>
			slot.textContent?.replace(/\s+/g, ' ').trim()
		);
		expect(sides[0]).toMatch(/^Red, alliance 4 /);
		expect(sides[1]).toMatch(/^Blue, alliance 5 /);
		expect(sides.filter((side) => side?.endsWith(', won'))).toHaveLength(1);
		expect(m1.querySelector('.slot.red .seed')).toHaveTextContent('A4');
		expect(m1.querySelector('.slot.blue .seed')).toHaveTextContent('A5');
		expect(screen.queryByText(/is on top in every match/)).toBeNull();
		const finals = screen.getByRole('region', { name: 'Finals' });
		const headers = within(finals).getAllByRole('rowheader');
		expect(headers[0]).toHaveTextContent(/^Alliance 2/);
		expect(within(finals).getAllByText(', won').length).toBeGreaterThan(0);
	});

	it('draws the 4 alliance bracket', () => {
		const { bracket } = bracketOf('UZTAQ1');
		show('UZTAQ1', bracket);
		const upper = screen.getByRole('region', { name: 'Upper bracket' });
		const lower = screen.getByRole('region', { name: 'Lower bracket' });
		expect(within(upper).getAllByRole('link')).toHaveLength(3);
		expect(within(lower).getAllByRole('link')).toHaveLength(2);
		expect(screen.queryByText(/won the event/)).toBeNull();
	});

	it('draws only the finals for 2 alliances', () => {
		const { bracket } = bracketOf('USALATQ');
		show('USALATQ', bracket);
		expect(screen.queryByRole('region', { name: 'Upper bracket' })).toBeNull();
		const finals = screen.getByRole('region', { name: 'Finals' });
		expect(
			within(finals)
				.getAllByRole('columnheader')
				.map((cell) => cell.textContent?.trim())
		).toEqual(['Alliance', 'F1', 'F2']);
		expect(screen.queryByText(/won the event/)).toBeNull();
	});

	it('marks an undecided third final as if needed', () => {
		const bundle = unplay(fixtureBundle('USALATQ'), (match) => match.key === 'p2');
		const bracket = buildBracket(bundle.alliances, bundle.matches) as BracketView;
		show('USALATQ', bracket);
		expect(bracket.finals.games.map((game) => game.label)).toEqual(['F1', 'F2', 'F3']);
		expect(screen.getByText('If needed')).toBeInTheDocument();
		expect(screen.queryByText(/won the event/)).toBeNull();
		expect(screen.getByText('Alliance 1 leads the finals 1–0.')).toBeInTheDocument();
	});

	it('shows when an unplayed final is scheduled', () => {
		const bundle = unplay(fixtureBundle('USMISOQ'), (match) => match.series === 11);
		const bracket = buildBracket(bundle.alliances, bundle.matches) as BracketView;
		show('USMISOQ', bracket);
		const finals = screen.getByRole('region', { name: 'Finals' });
		const m11 = within(finals).getByRole('link', { name: 'M11' }).closest('th')!;
		expect(m11).toHaveTextContent(/M11\s*\d{1,2}:\d{2}\s[AP]M/);
		expect(screen.getByText('Alliance 3 won M10, so M11 decides the event.')).toBeInTheDocument();
	});
});
