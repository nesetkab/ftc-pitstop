import { beforeAll, describe, expect, it } from 'vitest';
import type { EventBundle } from '#lib/types.ts';
import { fixtureLoaders } from './fixtures.server.ts';
import { playoffSummary } from './playoffs.ts';

let bundle: EventBundle;

beforeAll(async () => {
	bundle = await fixtureLoaders().loadEventBundle('USAZGIQ');
});

describe('playoffSummary', () => {
	it('reports a captain who lost the final', () => {
		expect(playoffSummary(bundle, 26670)).toBe('Captain of alliance 1, lost the final 81–178');
	});

	it('reports the winning alliance', () => {
		expect(playoffSummary(bundle, 18420)).toBe('Captain of alliance 2, won the final 178–81');
		expect(playoffSummary(bundle, 25620)).toBe('First pick of alliance 2, won the final 178–81');
	});

	it('reports where an eliminated alliance went out', () => {
		expect(playoffSummary(bundle, 14624)).toBe(
			'Captain of alliance 5, eliminated in lower bracket round 3'
		);
		expect(playoffSummary(bundle, 2844)).toBe(
			'First pick of alliance 5, eliminated in lower bracket round 3'
		);
		expect(playoffSummary(bundle, 26128)).toBe(
			'First pick of alliance 3, eliminated in lower bracket round 5'
		);
	});

	it('says so when a team was not picked', () => {
		const picked = new Set(
			bundle.alliances.flatMap((alliance) => [alliance.captain, ...alliance.picks])
		);
		const left = bundle.teams.find((team) => !picked.has(team.number));
		expect(left).toBeDefined();
		expect(playoffSummary(bundle, left!.number)).toBe('Not on an alliance');
	});

	it('shows only the alliance while selection is still going', () => {
		const selecting = { ...bundle, phase: 'selection' as const };
		expect(playoffSummary(selecting, 26670)).toBe('Captain of alliance 1');
		expect(playoffSummary(selecting, 2844)).toBe('First pick of alliance 5');
		const left = bundle.teams.find(
			(team) =>
				!bundle.alliances.some(
					(alliance) => alliance.captain === team.number || alliance.picks.includes(team.number)
				)
		);
		expect(playoffSummary(selecting, left!.number)).toBeNull();
	});

	it('says an alliance is still playing while the bracket is open', () => {
		const partial = {
			...bundle,
			phase: 'playoffs' as const,
			matches: bundle.matches.filter(
				(match) => match.level === 'qual' || (match.series <= 2 && match.level === 'playoff')
			)
		};
		expect(playoffSummary(partial, 14624)).toBe('Captain of alliance 5, still playing');
		expect(playoffSummary(partial, 26670)).toBe('Captain of alliance 1');
	});

	it('has nothing to say without alliances', () => {
		expect(playoffSummary({ ...bundle, alliances: [] }, 26670)).toBeNull();
	});
});
