import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createReporter } from './report.ts';
import TeamReport from './TeamReport.svelte';
import { fakeAnalysis, fixtureBundle, unplay } from './test-fixtures.ts';

afterEach(() => {
	cleanup();
});

function liveReport() {
	const event = unplay(
		fixtureBundle('KZASQ1'),
		(match) => match.level === 'playoff' || match.number > 40
	);
	const team = event.matches.find((match) => match.level === 'qual' && match.number > 40)!.red[0]
		.team;
	const report = createReporter({
		bundle: event,
		analysis: fakeAnalysis(event),
		season: null,
		seasonCount: null
	})(team)!;
	return { event, team, report };
}

describe('TeamReport', () => {
	it('shows takeaways, parts, the score strip and remaining matches', () => {
		const { event, team, report } = liveReport();
		render(TeamReport, {
			props: { report, code: event.event.code, timeZone: event.event.timezone }
		});
		expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(String(team));
		expect(screen.getByLabelText('Takeaways')).toHaveTextContent(`${report.takeaways[0]}.`);
		expect(screen.getByRole('img', { name: /Alliance score by match/ })).toBeInTheDocument();
		const next = screen.getByRole('heading', { name: 'Remaining matches' }).closest('section')!;
		const first = report.upcoming[0];
		const partner = first.partners[0];
		expect(within(next).getByRole('link', { name: String(partner) })).toHaveAttribute(
			'href',
			`/events/${event.event.code}/teams/${partner}`
		);
		expect(screen.getByRole('link', { name: 'Season page' })).toHaveAttribute(
			'href',
			`/teams/${team}`
		);
	});

	it('prints compactly with a notes area and no page actions', () => {
		const { event, report } = liveReport();
		const { container } = render(TeamReport, {
			props: { report, code: event.event.code, timeZone: event.event.timezone, compact: true }
		});
		expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument();
		expect(screen.getByRole('rowheader', { name: 'Event avg' })).toBeInTheDocument();
		expect(container.querySelector('.notes')).not.toBeNull();
		expect(
			within(screen.getByRole('list', { name: 'Takeaways' })).getAllByRole('listitem').length
		).toBe(report.takeaways.length);
	});
});
