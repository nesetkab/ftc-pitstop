import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import EventPreview from './EventPreview.svelte';
import { fakeAnalysis, fixtureBundle, unplay } from './test-fixtures.ts';

afterEach(() => {
	cleanup();
});

const bundle = unplay(fixtureBundle('USMTBUQ-final'), () => true);
const analysis = fakeAnalysis(fixtureBundle('USMTBUQ-final'));

function props(projections = analysis.projections) {
	return {
		code: bundle.event.code,
		teams: bundle.teams,
		matches: bundle.matches,
		timezone: bundle.event.timezone,
		ratings: analysis.ratings,
		projections
	};
}

describe('EventPreview', () => {
	it('predicts the top seeds from the posted schedule', () => {
		render(EventPreview, { props: props() });
		const table = screen.getByRole('table', { name: 'Teams at this event' });
		const headers = within(table)
			.getAllByRole('columnheader')
			.map((cell) => cell.textContent?.trim());
		expect(headers).toEqual(expect.arrayContaining(['Expected rank', 'Top 6']));
		const first = within(table).getAllByRole('row')[1];
		expect(first).toHaveTextContent(String(analysis.projections![0].team));
		expect(first).toHaveTextContent('1.0');
	});

	it('sticks to starting aOPR without projections', () => {
		render(EventPreview, { props: props(null) });
		expect(screen.queryByRole('columnheader', { name: 'Expected rank' })).toBeNull();
		expect(screen.queryByText(/alliance captains/)).toBeNull();
	});

	it('says once that the teams and schedule are not out yet', () => {
		render(EventPreview, { props: { ...props(), teams: [], matches: [] } });
		expect(
			screen.getByText("The team list and match schedule haven't been posted yet.")
		).toBeInTheDocument();
		expect(screen.queryByRole('table')).toBeNull();
	});

	it('keeps the team list for a finished event that posted no matches', () => {
		render(EventPreview, { props: { ...props(), matches: [], phase: 'done' as const } });
		expect(screen.getByText('No match schedule was posted for this event.')).toBeInTheDocument();
		expect(screen.getByRole('table', { name: 'Teams at this event' })).toBeInTheDocument();
	});
});
