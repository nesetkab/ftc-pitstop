import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { AllianceOdds, EventAnalysis } from '#lib/analysis/types.ts';
import type { AllianceSelection, Ranking, Team } from '#lib/types.ts';
import { pickMarks, setAvoid, setNote } from '#lib/workspace/picklist.ts';
import { deriveSelection, selectionTable } from '#lib/workspace/selection.ts';
import AllianceTable from './AllianceTable.svelte';
import AvailableTeams from './AvailableTeams.svelte';
import PlayoffOdds from './PlayoffOdds.svelte';
import SimulateAlliances from './SimulateAlliances.svelte';

afterEach(() => cleanup());

const alliances: AllianceSelection[] = [
	{ seed: 1, name: 'Alliance 1', captain: 100, picks: [101], backup: null, backupReplaced: null },
	{ seed: 2, name: 'Alliance 2', captain: 200, picks: [], backup: null, backupReplaced: null },
	{ seed: 3, name: 'Alliance 3', captain: 300, picks: [], backup: null, backupReplaced: null }
];

const names: Record<number, string> = {
	100: 'Iron Eagles',
	101: 'Unscheduled',
	200: 'Metal Masters',
	201: 'Valley X',
	300: 'Grape Nerds',
	301: 'The Titans'
};

const teams: Team[] = Object.entries(names).map(([number, name]) => ({
	number: Number(number),
	name,
	fullName: null,
	school: null,
	city: null,
	state: null,
	country: null,
	rookieYear: null
}));

function ranking(team: number, rank: number): Ranking {
	return {
		rank,
		team,
		rs: 4.4 - rank * 0.3,
		tbp: 90 - rank,
		avgTips: 2.5,
		avgAuto: 20,
		wins: 3,
		losses: 1,
		ties: 0,
		played: 4,
		dq: 0
	};
}

const rankings = [100, 101, 200, 300, 201, 301].map((team, index) => ranking(team, index + 1));

const selection = deriveSelection(alliances);

describe('simulate a playoff match', () => {
	it('links the first two alliances and follows the chosen ones', async () => {
		render(SimulateAlliances, { props: { alliances } });
		const link = screen.getByRole('link', { name: 'Simulate this match' });
		expect(link).toHaveAttribute('href', '/simulate?red=100,101&blue=200');
		const blue = screen.getByRole('combobox', { name: 'Blue alliance' });
		await fireEvent.change(blue, { target: { value: '3' } });
		expect(link).toHaveAttribute('href', '/simulate?red=100,101&blue=300');
	});
});

describe('alliance table', () => {
	it('lists every alliance with its captain and pick', () => {
		render(AllianceTable, { props: { selection } });
		const rows = screen.getAllByRole('row').slice(1);
		expect(rows).toHaveLength(3);
		expect(rows[0]).toHaveTextContent('1');
		expect(within(rows[0]).getByRole('link', { name: '100' })).toHaveAttribute(
			'href',
			'/teams/100'
		);
		expect(within(rows[0]).getByRole('link', { name: '101' })).toBeInTheDocument();
	});

	it('shows who is picking and who is waiting', () => {
		render(AllianceTable, { props: { selection } });
		const rows = screen.getAllByRole('row').slice(1);
		expect(rows[1]).toHaveTextContent('Picking');
		expect(rows[2]).toHaveTextContent('Waiting');
		expect(rows[0]).not.toHaveTextContent('Picking');
	});

	it('marks the alliance of our team', () => {
		render(AllianceTable, { props: { selection, me: 101 } });
		const rows = screen.getAllByRole('row').slice(1);
		expect(rows[0]).toHaveClass('me');
		expect(rows[1]).not.toHaveClass('me');
	});

	it('adds columns for extra picks and backups', () => {
		const full = deriveSelection([
			{ ...alliances[0], picks: [101, 102], backup: 103 },
			{ ...alliances[1], picks: [201, 202] }
		]);
		render(AllianceTable, { props: { selection: full } });
		expect(screen.getByRole('columnheader', { name: 'First pick' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Second pick' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Backup' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: '103' })).toBeInTheDocument();
	});
});

describe('available teams', () => {
	it('shows our pick list place and notes under each team', () => {
		const table = selectionTable({ teams, rankings, matches: [] }, null, selection);
		const list = setAvoid(
			setNote(
				{
					event: null,
					entries: [201, 301].map((team) => ({ team, name: null, note: '', taken: false }))
				},
				201,
				'Fast intake'
			),
			301,
			true
		);
		render(AvailableTeams, { props: { table, marks: pickMarks(list) } });
		const row = (team: string) =>
			screen.getAllByRole('row').find((item) => item.textContent?.includes(team));
		expect(row('Valley X')).toHaveTextContent('Our #1 · Fast intake');
		expect(row('The Titans')).toHaveTextContent('Do not pick');
		expect(row('Grape Nerds')).not.toHaveTextContent('Our #');
	});

	it('shows ranking columns when there is no analysis', () => {
		const table = selectionTable({ teams, rankings, matches: [] }, null, selection);
		render(AvailableTeams, { props: { table } });
		const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
		expect(headers).toEqual([
			'Team',
			'RS',
			'TBP',
			'Avg auto',
			'Avg tips',
			'Avg park',
			'Rank',
			'Note'
		]);
		const rows = screen.getAllByRole('row').slice(1);
		expect(rows[0]).toHaveTextContent('300');
		expect(rows[0]).toHaveTextContent('Grape Nerds');
		expect(rows[0]).toHaveTextContent('Captain of alliance 3');
	});

	it('puts taken teams last, dimmed, with who took them', () => {
		const table = selectionTable({ teams, rankings, matches: [] }, null, selection);
		render(AvailableTeams, { props: { table } });
		const rows = screen.getAllByRole('row').slice(1);
		const taken = rows.filter((row) => row.classList.contains('dim'));
		expect(taken).toHaveLength(3);
		expect(rows.slice(-3)).toEqual(taken);
		expect(taken[0]).toHaveTextContent('Captain of alliance 1');
		expect(taken[1]).toHaveTextContent('Picked by alliance 1');
		expect(taken[2]).toHaveTextContent('Captain of alliance 2');
	});

	it('shows aOPR columns when ratings exist', () => {
		const analysis = {
			ratings: [
				{
					team: 201,
					opr: 47.4,
					parts: { auto: 24.5, hive: 0, flower: 0, garden: 0, park: 7, tips: 0 },
					matches: 4,
					rank: 1,
					prior: 0,
					history: []
				}
			]
		} as unknown as EventAnalysis;
		const table = selectionTable({ teams, rankings, matches: [] }, analysis, selection);
		render(AvailableTeams, { props: { table } });
		const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
		expect(headers.slice(0, 3)).toEqual(['Team', 'aOPR', 'Auto aOPR']);
		const row = screen.getByText('Valley X').closest('tr') as HTMLElement;
		expect(row).toHaveTextContent('47.4');
		expect(row).toHaveTextContent('24.5');
	});

	it('shows playoff chances and the captain note when the analysis has picks', () => {
		const analysis = {
			ratings: [],
			picks: {
				seed: 2,
				captain: 200,
				options: [
					{
						team: 300,
						opr: 38.9,
						auto: 15,
						tips: 2.6,
						park: 5,
						winRound1: 0.66,
						reachUpperFinal: 0.02,
						winEvent: 0.01,
						promotesCaptain: 301
					},
					{
						team: 201,
						opr: 47.4,
						auto: 24.5,
						tips: 2.2,
						park: 7,
						winRound1: 0.76,
						reachUpperFinal: 0.05,
						winEvent: 0.04,
						promotesCaptain: null
					}
				]
			}
		} as unknown as EventAnalysis;
		const table = selectionTable(
			{ teams, rankings, matches: [] },
			analysis,
			deriveSelection([{ ...alliances[0] }, { ...alliances[1] }, { ...alliances[2] }])
		);
		render(AvailableTeams, { props: { table } });
		expect(screen.getByRole('columnheader', { name: 'Win round 1' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Reach upper final' })).toBeInTheDocument();
		expect(screen.getByRole('columnheader', { name: 'Win event' })).toBeInTheDocument();
		const rows = screen.getAllByRole('row').slice(1);
		expect(rows[0]).toHaveTextContent('201');
		expect(rows[0]).toHaveTextContent('76%');
		expect(rows[0]).toHaveTextContent('5%');
		expect(rows[1]).toHaveTextContent('300');
		expect(rows[1]).toHaveTextContent('Makes 301 captain of alliance 3');
	});
});

describe('chance to win the event', () => {
	const odds = (seed: number, winEvent: number): AllianceOdds => ({
		seed,
		teams: [seed],
		strength: 0,
		winEvent,
		reachFinal: 0,
		winNext: 0
	});

	it('lists alliances from most to least likely and groups long shots', () => {
		render(PlayoffOdds, {
			props: { odds: [odds(1, 0.27), odds(2, 0.71), odds(3, 0.001), odds(4, 0.002), odds(5, 0)] }
		});
		const rows = screen.getAllByRole('row').slice(1);
		expect(
			rows.map((row) =>
				within(row)
					.getAllByRole('cell')
					.map((cell) => cell.textContent?.trim())
			)
		).toEqual([
			['Alliance 2', '71%'],
			['Alliance 1', '27%'],
			['Alliances 3 to 5', '<1%']
		]);
	});
});
