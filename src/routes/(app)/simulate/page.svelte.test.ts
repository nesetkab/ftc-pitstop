import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyParts, type FitParts } from '#lib/components/compare/fit.ts';
import type { SimSide, SimTeam, Simulation } from '#lib/components/simulate/simulate.ts';
import Page from './+page.svelte';

afterEach(() => {
	cleanup();
});

const parts = (overrides: Partial<FitParts>): FitParts => ({ ...emptyParts(), ...overrides });

function team(number: number, name: string, overrides: Partial<FitParts>, rated = true): SimTeam {
	const all = parts(overrides);
	return { number, name, opr: all.auto + all.teleop, rated, parts: all };
}

function side(color: 'red' | 'blue', teams: SimTeam[], score: number): SimSide {
	const all = parts({});
	for (const entry of teams)
		for (const key of Object.keys(all) as (keyof FitParts)[]) all[key] += entry.parts[key];
	const np = teams.reduce((sum, entry) => sum + entry.opr, 0);
	return {
		color,
		teams,
		score,
		np,
		fouls: score - np,
		low: score - 20,
		high: score + 20,
		parts: all
	};
}

const rp = (win: number, pollinator1: number) => ({
	win,
	tie: 0.02,
	swarm: 0.6,
	pollinator1,
	pollinator2: 0.05,
	expected: 2.4
});

const simulation: Simulation = {
	red: side(
		'red',
		[
			team(724, 'Alpha', { auto: 30, teleop: 40, hive: 34, park: 6, tips: 3 }),
			team(10662, 'Bravo', { auto: 8, teleop: 42, hive: 36, park: 6, tips: 2 })
		],
		124
	),
	blue: side(
		'blue',
		[
			team(5026, 'Charlie', { auto: 12, teleop: 30, hive: 26, park: 4, tips: 1 }),
			team(4133, 'Delta', { auto: 10, teleop: 20, hive: 16, park: 4, tips: 1 }, false)
		],
		76
	),
	forecast: {
		key: 'simulate',
		red: { score: 124, sd: 16, win: 0.81, rp: rp(0.81, 0.7) },
		blue: { score: 76, sd: 15, win: 0.17, rp: rp(0.17, 0.2) },
		tie: 0.02,
		played: false,
		correct: null
	},
	margin: 48,
	marginSd: 30,
	notes: ['Auto is the biggest gap: Red is expected to score 38.0 auto points to Blue’s 22.0.']
};

function show(overrides: Record<string, unknown> = {}) {
	const data = {
		sides: { red: [724, 10662], blue: [5026, 4133] },
		picked: {
			red: [
				{ number: 724, name: 'Alpha' },
				{ number: 10662, name: 'Bravo' }
			],
			blue: [
				{ number: 5026, name: 'Charlie' },
				{ number: 4133, name: 'Delta' }
			]
		},
		missing: [],
		simulation,
		suggestion: null,
		ready: true,
		...overrides
	};
	render(Page, { props: { data, params: {} } as never });
}

describe('simulate page', () => {
	it('names each alliance in words and prefills the picker', () => {
		show();
		expect(screen.getByRole('group', { name: 'Red alliance' })).toBeInTheDocument();
		const blue = screen.getByRole('group', { name: 'Blue alliance' });
		expect(within(blue).getByRole('combobox', { name: 'Blue 1' })).toHaveValue('5026');
		expect(within(blue).getByRole('link', { name: 'Remove 4133 from Blue 2' })).toHaveAttribute(
			'href',
			'/simulate?red=724,10662&blue=5026'
		);
		expect(screen.getByRole('link', { name: 'Swap sides' })).toHaveAttribute(
			'href',
			'/simulate?red=5026,4133&blue=724,10662'
		);
	});

	it('shows the odds, the range, the parts and the notes', () => {
		show();
		expect(screen.getByLabelText('Verdict')).toHaveTextContent(
			'Red is favored. It wins 81% of the time and Blue wins 17%. The chance of a tie is 2%.'
		);
		expect(screen.getByText(/Red scores 104 to 144 and Blue scores 56 to 96/)).toBeInTheDocument();
		const parts = screen.getByRole('table', { name: 'Predicted points by part for each alliance' });
		const autoRow = within(parts).getByRole('row', { name: /Auto/ });
		expect(within(autoRow).getByText('Red +16.0')).toBeInTheDocument();
		expect(within(autoRow).getByText('724 79%')).toBeInTheDocument();
		expect(screen.getByText(/Auto is the biggest gap/)).toBeInTheDocument();
		expect(screen.getByText('Expected RP')).toBeInTheDocument();
		expect(screen.getByText(/No matches yet this season for 4133/)).toBeInTheDocument();
	});

	it('links to compare with the same teams from the tab row', () => {
		show();
		const tabs = screen.getByRole('navigation', { name: 'Team tools' });
		expect(within(tabs).getByRole('link', { name: 'Compare' })).toHaveAttribute(
			'href',
			'/compare?teams=724,10662,5026,4133'
		);
		expect(within(tabs).getByRole('link', { name: 'Simulate' })).toHaveAttribute(
			'href',
			'/simulate?red=724,10662&blue=5026,4133'
		);
	});

	it('asks for teams and offers the top four when nothing is picked', () => {
		show({
			sides: { red: [], blue: [] },
			picked: { red: [], blue: [] },
			simulation: null,
			suggestion: { sides: { red: [1, 4], blue: [2, 3] }, names: { 1: 'One' } }
		});
		expect(screen.getByText('Pick two teams for each alliance.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: '1 One and 4 vs 2 and 3' })).toHaveAttribute(
			'href',
			'/simulate?red=1,4&blue=2,3'
		);
		expect(screen.queryByRole('link', { name: 'Swap sides' })).not.toBeInTheDocument();
	});

	it('says when ratings are still loading and names unknown teams', () => {
		show({ simulation: null, ready: false, missing: [424242] });
		expect(
			screen.getByText('Season ratings are still loading. Try again in a minute.')
		).toBeInTheDocument();
		expect(screen.getByRole('status')).toHaveTextContent('No team has the number 424242.');
	});
});
