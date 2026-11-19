import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScheduleView from './ScheduleView.svelte';
import { fakeAnalysis, fixtureBundle, unplay } from './test-fixtures.ts';

afterEach(() => {
	cleanup();
});

const bundle = fixtureBundle('USAZGIQ');

function props(extra: Record<string, unknown> = {}) {
	return {
		code: bundle.event.code,
		matches: bundle.matches,
		teams: bundle.teams,
		timezone: bundle.event.timezone,
		...extra
	};
}

function matchLabels() {
	return screen
		.getAllByRole('table', { name: 'Match schedule' })
		.flatMap((table) => within(table).queryAllByRole('link'))
		.map((link) => link.textContent?.trim());
}

describe('ScheduleView', () => {
	it('lists every qualification and playoff match', () => {
		render(ScheduleView, { props: props() });
		expect(screen.getByRole('heading', { name: 'Qualification matches' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Playoff matches' })).toBeInTheDocument();
		const labels = matchLabels();
		expect(labels).toHaveLength(44);
		expect(labels.slice(0, 3)).toEqual(['Q1', 'Q2', 'Q3']);
		expect(labels.at(-1)).toBe('M10');
		const q1 = screen.getByRole('link', { name: 'Q1' }).closest('tr')!;
		expect(q1).toHaveTextContent('10:30');
		expect(within(q1).getByText('89')).toHaveClass('won');
		expect(screen.queryByText('Predicted')).toBeNull();
	});

	it('filters to one team and reports the change', async () => {
		const onteam = vi.fn();
		render(ScheduleView, { props: props({ onteam }) });
		await fireEvent.change(screen.getByLabelText('Team'), { target: { value: '14624' } });
		expect(onteam).toHaveBeenCalledWith(14624);
		const labels = matchLabels();
		expect(labels).toEqual(['Q5', 'Q14', 'Q17', 'Q26', 'Q31', 'M1', 'M3', 'M5']);
		expect(screen.getByText('8 matches')).toBeInTheDocument();
		await fireEvent.change(screen.getByLabelText('Team'), { target: { value: '' } });
		expect(onteam).toHaveBeenLastCalledWith(null);
		expect(matchLabels()).toHaveLength(44);
	});

	it('starts from a team passed in', () => {
		render(ScheduleView, { props: props({ team: 2844 }) });
		expect(matchLabels().every((label) => label)).toBe(true);
		expect(screen.getByLabelText('Team')).toHaveValue('2844');
		expect(screen.getByText('8 matches')).toBeInTheDocument();
	});

	it('shows predictions and expected times for unplayed matches', () => {
		const later = unplay(bundle, (match) => match.level === 'playoff' || match.number > 30);
		render(ScheduleView, {
			props: { ...props(), matches: later.matches, ...pick(fakeAnalysis(later)) }
		});
		const table = screen.getAllByRole('table', { name: 'Match schedule' })[0];
		expect(
			within(table)
				.getAllByRole('columnheader')
				.map((cell) => cell.textContent)
		).toEqual(['Match', 'Time', 'Expected', 'Red', 'Blue', 'Score', 'Predicted', 'Win chance']);
		const q31 = screen.getByRole('link', { name: 'Q31' }).closest('tr')!;
		const cells = Array.from(q31.querySelectorAll('td')).map((cell) => cell.textContent?.trim());
		expect(cells[2]).toMatch(/^\d{1,2}:\d{2}\s?PM$/);
		expect(cells[5]).toBe('');
		expect(cells[6]).toMatch(/^\d+–\d+$/);
		expect(cells[7]).toMatch(/^(Red|Blue) \d+%$/);
	});

	it('marks followed teams', () => {
		render(ScheduleView, { props: props({ followed: new Set([14624]) }) });
		const marked = document.querySelectorAll('.team-chip.me');
		expect(marked.length).toBe(8);
		expect([...marked].every((chip) => chip.textContent?.trim() === '14624')).toBe(true);
	});
});

function pick(analysis: ReturnType<typeof fakeAnalysis>) {
	return { forecasts: analysis.forecasts, timing: analysis.timing };
}
