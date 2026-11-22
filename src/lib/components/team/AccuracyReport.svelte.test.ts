import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import sample from './accuracy-sample.json';
import AccuracyReport from './AccuracyReport.svelte';
import { isAccuracyReport, type AccuracyReport as Report } from './accuracy.ts';

afterEach(() => {
	cleanup();
});

function load(): Report {
	const value: unknown = sample;
	if (!isAccuracyReport(value)) throw new Error('The sample file is not a valid report');
	return value;
}

function show(report: Report = load(), props: { sample?: boolean } = {}) {
	return render(AccuracyReport, { props: { report, ...props } });
}

function section(name: string): HTMLElement {
	return screen.getByRole('heading', { name }).closest('section') as HTMLElement;
}

function cells(row: HTMLElement): string[] {
	return [...row.querySelectorAll('td, th')].map((cell) => cell.textContent?.trim() ?? '');
}

describe('accuracy page', () => {
	it('explains the method and how the data was split', () => {
		show();
		const method = section('Method');
		expect(within(method).getByText(/predicts matches from OPR/)).toBeInTheDocument();
		expect(
			within(method).getByText(/Parameters were set on\s+2021 to 2023/, { exact: false })
		).toHaveTextContent(
			'Parameters were set on 2021 to 2023, the model was chosen on 2024 and 2025, and 2026 was not used for either.'
		);
		expect(within(method).getByText(/predicted using only matches played before it/)).toBeVisible();
	});

	it('uses the model label when it is not the OPR model', () => {
		const report = load();
		show({ ...report, chosen: { id: 'epa', label: 'EPA, sequential updates' } });
		expect(
			screen.getByText('PitStop predicts matches with this model: EPA, sequential updates.')
		).toBeInTheDocument();
	});

	it('has one group per season, newest first, with every model in it', () => {
		show();
		const table = within(section('Results by season')).getByRole('table');
		const groups = within(table)
			.getAllByRole('rowheader')
			.map((header) => header.textContent?.replace(/\s+/g, ' ').trim());
		expect(groups).toEqual([
			'2026, BIOBUZZ 6,463 matches. Not used for tuning',
			'2025, DECODE 45,230 matches. Used to choose the model',
			'2024, INTO THE DEEP 39,799 matches. Used to choose the model'
		]);
		const modelRows = within(table)
			.getAllByRole('row')
			.filter((row) => row.querySelectorAll('td').length === 5);
		expect(modelRows).toHaveLength(9);
	});

	it('shows accuracy, Brier score, log loss and score error for each model', () => {
		show();
		const table = within(section('Results by season')).getByRole('table');
		const headers = within(table)
			.getAllByRole('columnheader')
			.map((header) => header.textContent);
		expect(headers).toEqual(['Model', 'Winner accuracy', 'Brier score', 'Log loss', 'Score error']);
		const firstSeason = table.querySelector('tbody') as HTMLElement;
		const rows = [...firstSeason.querySelectorAll('tr')].slice(1).map((row) => cells(row));
		const chosen = rows.find((row) => row[0].startsWith('OPR with priors'));
		expect(chosen?.slice(1)).toEqual(['73.4%', '0.174', '0.527', '14.3']);
		const eventOnly = rows.find((row) => row[0].startsWith('OPR, this event only'));
		expect(eventOnly?.slice(1)).toEqual(['68.2%', '0.199', '0.585', '17.6']);
	});

	it('highlights the model the site uses in every season', () => {
		show();
		const table = within(section('Results by season')).getByRole('table');
		const highlighted = table.querySelectorAll('tr.chosen');
		expect(highlighted).toHaveLength(3);
		for (const row of highlighted) {
			expect(row).toHaveTextContent('OPR with priors');
			expect(row).toHaveTextContent('Used on this site');
		}
		expect(within(table).getAllByText('Used on this site')).toHaveLength(3);
	});

	it('defines the measures in plain words', () => {
		show();
		const terms = section('Results by season').querySelectorAll('dt');
		expect([...terms].map((term) => term.textContent)).toEqual([
			'Winner accuracy',
			'Brier score',
			'Log loss',
			'Score error'
		]);
	});

	it('draws the calibration chart to scale with a y = x reference line', () => {
		show();
		const chart = within(section('Win chance calibration')).getByRole('img', {
			name: 'Predicted chance that red wins against how often red won'
		});
		const reference = chart.querySelector('line.reference') as SVGLineElement;
		const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((name) =>
			Number(reference.getAttribute(name))
		);
		expect(x2 - x1).toBe(y1 - y2);
		expect(x2 - x1).toBe(300);

		const circles = [...chart.querySelectorAll('circle')];
		expect(circles).toHaveLength(20);
		const first = circles[0];
		expect(Number(first.getAttribute('cx'))).toBeCloseTo(x1 + 0.0549 * 300, 1);
		expect(Number(first.getAttribute('cy'))).toBeCloseTo(y1 - 0.053 * 300, 1);
		const last = circles[9];
		expect(Number(last.getAttribute('cx'))).toBeCloseTo(x1 + 0.9463 * 300, 1);
		expect(Number(last.getAttribute('cy'))).toBeCloseTo(y1 - 0.9533 * 300, 1);
	});

	it('labels both axes and lists the two groups of seasons', () => {
		show();
		const calibration = section('Win chance calibration');
		expect(
			within(calibration).getByText('Predicted chance that red wins', { selector: 'text' })
		).toBeInTheDocument();
		expect(
			within(calibration).getByText('Share of matches red won', { selector: 'text' })
		).toBeInTheDocument();
		const legend = [...calibration.querySelectorAll('.legend li')].map((item) =>
			item.textContent?.trim()
		);
		expect(legend).toEqual(['2024 and 2025', '2026', 'Predicted equals actual']);
	});

	it('gives the calibration numbers in a table', () => {
		show();
		const table = within(section('Win chance calibration')).getByRole('table');
		const rows = [...table.querySelectorAll('tbody tr')] as HTMLElement[];
		expect(rows).toHaveLength(10);
		expect(rows[0].querySelector('td .full')).toHaveTextContent('0% to 10%');
		expect(cells(rows[0]).slice(1)).toEqual(['5.5%', '5.3%', '6,722', '5.5%', '4.9%', '399']);
	});

	it('fits the calibration table on a phone without losing the predicted and won numbers', () => {
		show();
		const table = within(section('Win chance calibration')).getByRole('table');
		const first = table.querySelector('tbody tr') as HTMLElement;
		expect(first.querySelector('td span.short[aria-hidden="true"]')).toHaveTextContent('0–10%');
		expect(first.querySelector('td .visually-hidden')).toHaveTextContent('0% to 10%');
		const optional = [...first.querySelectorAll('td.opt')].map((cell) => cell.textContent?.trim());
		expect(optional).toEqual(['6,722', '399']);
		const headers = within(table).getAllByRole('columnheader', { name: 'Matches' });
		expect(headers.every((header) => header.classList.contains('opt'))).toBe(true);
		expect(within(table).getAllByRole('columnheader', { name: 'Predicted' })).toHaveLength(2);
		const spans = [...table.querySelectorAll('thead tr.short th.group')].map((th) =>
			th.getAttribute('colspan')
		);
		expect(spans).toEqual(['2', '2']);
	});

	it('shows ranking point calibration with the base rate Brier score', () => {
		show();
		const rp = section('Ranking point chances');
		const table = within(rp).getAllByRole('table')[0];
		const rows = within(table)
			.getAllByRole('row')
			.slice(1)
			.map((row) => cells(row));
		expect(rows.map((row) => row[0])).toEqual([
			'Swarm, leave and park 16+',
			'Pollinator 1, 4+ tips',
			'Pollinator 2, 7+ tips'
		]);
		expect(rows[0].slice(1)).toEqual(['62.8%', '0.192', '0.234', '0.564']);
		expect(rows[1].slice(1)).toEqual(['7.4%', '0.036', '0.068', '0.128']);
		expect(within(rp).getAllByRole('img')).toHaveLength(3);
	});

	it('shows the queue time estimate error by how far ahead the match is', () => {
		show();
		const table = within(section('Queue time estimates')).getByRole('table');
		const headers = within(table)
			.getAllByRole('columnheader')
			.map((header) => header.textContent);
		expect(headers).toEqual(['Matches ahead', 'Median error in minutes', '1', '2', '3', '5', '10']);
		const groups = within(table)
			.getAllByRole('rowheader')
			.map((header) => header.textContent?.replace(/\s+/g, ' ').trim());
		expect(groups).toEqual(['Qualification matches 312 events', 'Playoff matches 40 events']);
		const quals = table.querySelectorAll('tbody')[0];
		const rows = [...quals.querySelectorAll('tr')].slice(1).map((row) => cells(row));
		expect(rows[0]).toEqual(['Our estimate', '1.2', '1.9', '2.6', '4.1', '6.9']);
		expect(rows[1]).toEqual([
			'Printed schedule plus current delay',
			'1.4',
			'2.4',
			'3.4',
			'5.1',
			'8.2'
		]);
		expect(rows[2]).toEqual(['Printed schedule', '15.1', '15.4', '15.6', '15.6', '14.8']);
		expect(rows[3]).toEqual(['Estimates measured', '5,831', '5,519', '5,207', '4,583', '3,072']);
	});

	it('leaves out sections the report has no data for', () => {
		const { calibration, rp, schedule, ...rest } = load();
		void calibration;
		void rp;
		void schedule;
		show(rest);
		expect(
			screen.queryByRole('heading', { name: 'Win chance calibration' })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole('heading', { name: 'Ranking point chances' })
		).not.toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Queue time estimates' })).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Results by season' })).toBeInTheDocument();
	});

	it('marks sample numbers and says when the results were generated', () => {
		show(load(), { sample: true });
		expect(screen.getByText(/Sample numbers/)).toBeInTheDocument();
		expect(screen.getByText(/Results generated Thursday, November 19, 2026/)).toBeInTheDocument();
		cleanup();
		show();
		expect(screen.queryByText(/Sample numbers/)).not.toBeInTheDocument();
	});
});
