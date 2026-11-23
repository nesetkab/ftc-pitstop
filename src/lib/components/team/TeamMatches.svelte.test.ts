import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { TeamMatchEvent } from './matches.ts';
import TeamMatches from './TeamMatches.svelte';

afterEach(() => cleanup());

function event(code: string, name: string, start: string): TeamMatchEvent {
	return {
		code,
		name,
		start,
		end: start,
		record: { wins: 1, losses: 0, ties: 0 },
		rows: [
			{
				key: 'q1',
				label: 'Q1',
				alliance: 'red',
				partners: [2],
				opponents: [3, 4],
				score: 90,
				against: 60,
				outcome: 'win',
				parts: null,
				surrogate: false
			}
		]
	};
}

describe('team matches', () => {
	it('builds an older event table only once it is opened', async () => {
		render(TeamMatches, {
			props: {
				events: [
					event('BBB', 'Later Qualifier', '2026-11-20'),
					event('AAA', 'Early Meet', '2026-11-01')
				],
				team: 1
			}
		});
		expect(
			screen.getByRole('table', { name: 'Matches for 1 at Later Qualifier' })
		).toBeInTheDocument();
		expect(screen.queryByRole('table', { name: 'Matches for 1 at Early Meet' })).toBeNull();
		const details = screen.getByText('Early Meet').closest('details') as HTMLDetailsElement;
		details.open = true;
		await fireEvent(details, new Event('toggle'));
		expect(screen.getByRole('table', { name: 'Matches for 1 at Early Meet' })).toBeInTheDocument();
	});
});
