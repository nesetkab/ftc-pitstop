import { describe, expect, it } from 'vitest';
import { fixtureBundle } from '#lib/components/pit/fixtures.ts';
import { breakdownsOf, withBreakdowns, withoutBreakdowns } from './breakdowns.ts';

const bundle = fixtureBundle('USAZGIQ');

describe('score breakdowns', () => {
	it('drops the breakdowns but keeps every score and team', () => {
		const lite = withoutBreakdowns(bundle);
		expect(lite.matches).toHaveLength(bundle.matches.length);
		for (const [index, match] of lite.matches.entries()) {
			const full = bundle.matches[index];
			expect(match.result?.red.total).toBe(full.result?.red.total);
			expect(match.result?.blue.total).toBe(full.result?.blue.total);
			expect(match.result?.red.breakdown ?? null).toBeNull();
			expect(match.result?.blue.breakdown ?? null).toBeNull();
			expect(match.red).toEqual(full.red);
		}
		expect(bundle.matches.some((match) => match.result?.red.breakdown)).toBe(true);
	});

	it('makes the bundle much smaller', () => {
		const full = JSON.stringify(bundle).length;
		expect(JSON.stringify(withoutBreakdowns(bundle)).length).toBeLessThan(full * 0.6);
	});

	it('puts the breakdowns back so the result is the full bundle', () => {
		const lite = withoutBreakdowns(bundle);
		expect(withBreakdowns(lite, breakdownsOf(bundle.matches))).toEqual(bundle);
	});

	it('leaves matches without a known breakdown as summary only', () => {
		const lite = withoutBreakdowns(bundle);
		const merged = withBreakdowns(lite, {});
		expect(merged).toEqual(lite);
	});
});
