import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventAnalysis } from '#lib/analysis/types.ts';
import { replayBundle, replayStart } from '#lib/game/replay.ts';
import BriefPanel from './BriefPanel.svelte';
import { matchBrief } from './brief.ts';
import { fixtureBundle } from './fixtures.ts';
import { pitView } from './view.ts';

const stakes = vi.hoisted(() => ({ matchStakes: vi.fn() }));

vi.mock('#lib/components/event/stakes.ts', () => ({ matchStakes: stakes.matchStakes }));

const TEAM = 14624;
const full = fixtureBundle('USAZGIQ');
const bundle = replayBundle(full, replayStart('Q22', full)!);
const next = pitView({ bundle, analysis: null, queue: null, team: TEAM }).next!;
const brief = matchBrief(next, []);
const analysis = { generatedAt: 1 } as EventAnalysis;

function show(stakesKey: string | null) {
	render(BriefPanel, {
		props: {
			brief,
			stakesKey,
			matches: bundle.matches,
			rankings: bundle.rankings,
			analysis,
			team: TEAM,
			href: (team: number) => `/teams/${team}`
		}
	});
}

afterEach(() => {
	cleanup();
	stakes.matchStakes.mockReset();
});

describe('BriefPanel', () => {
	it('works out what the next match means for a top spot', () => {
		stakes.matchStakes.mockReturnValue({
			spots: 4,
			teams: [{ team: TEAM, now: 0.4, win: 0.55, loss: 0.25 }]
		});
		show('key');
		expect(stakes.matchStakes).toHaveBeenCalledWith(
			expect.objectContaining({ match: expect.objectContaining({ key: brief.key }), analysis })
		);
		expect(
			screen.getByText('Chance to finish top 4: 40% now, 55% with a win, 25% with a loss.')
		).toBeInTheDocument();
		expect(screen.getByRole('table', { name: `Scoring by part for ${brief.label}` })).toBeVisible();
	});

	it('skips the stakes when there is nothing to work out', () => {
		show(null);
		expect(stakes.matchStakes).not.toHaveBeenCalled();
		expect(screen.queryByText(/Chance to finish top/)).toBeNull();
	});
});
