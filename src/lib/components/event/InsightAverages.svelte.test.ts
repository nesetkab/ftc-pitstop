import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import InsightAverages from './InsightAverages.svelte';
import { eventRecordRows, partAverages, partHighs, type PartAverages } from './insights.ts';
import { fixtureBundle } from './test-fixtures.ts';

afterEach(() => {
	cleanup();
});

const bundle = fixtureBundle('USAZGIQ');
const rows = eventRecordRows(bundle.event, bundle.matches);
const quals = rows.filter((row) => row.level === 'qual');
const season = { ...partAverages(rows)!, total: 50 } satisfies PartAverages;

function headers() {
	return screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim());
}

function totalRow() {
	return screen.getByRole('rowheader', { name: 'Total' }).closest('tr') as HTMLElement;
}

describe('InsightAverages', () => {
	it('shows the all matches average that vs season is based on', () => {
		const event = partAverages(rows)!;
		render(InsightAverages, {
			props: {
				qual: partAverages(quals),
				playoff: partAverages(rows.filter((row) => row.level === 'playoff')),
				event,
				high: partHighs(rows),
				season
			}
		});
		expect(headers()).toEqual([
			'Part',
			'Quals',
			'Playoffs',
			'All matches',
			'Best here',
			'Season',
			'Vs season'
		]);
		const cells = within(totalRow()).getAllByRole('cell');
		expect(cells[2]).toHaveTextContent(event.total.toFixed(1));
		expect(cells[2]).not.toHaveClass('opt');
		expect(cells[0]).toHaveClass('opt');
		expect(cells[1]).toHaveClass('opt');
		expect(cells[5]).toHaveTextContent(`+${(event.total - 50).toFixed(1)}`);
	});

	it('compares quals with the season when there are no playoffs', () => {
		const event = partAverages(quals)!;
		render(InsightAverages, {
			props: { qual: event, playoff: null, event, high: partHighs(quals), season }
		});
		expect(headers()).toEqual(['Part', 'Quals', 'Best here', 'Season', 'Vs season']);
		const cells = within(totalRow()).getAllByRole('cell');
		expect(cells[0]).not.toHaveClass('opt');
		expect(cells[0]).toHaveTextContent(event.total.toFixed(1));
		expect(cells[3]).toHaveTextContent(`+${(event.total - 50).toFixed(1)}`);
	});
});
