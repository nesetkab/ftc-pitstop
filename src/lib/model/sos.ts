import { RP_RULES, type RpRules } from './rp.ts';
import { tallyResults } from './simulate.ts';
import type { ModelMatch } from './types.ts';

export type SosInput = {
	matches: ModelMatch[];
	rating: (team: number) => number;
	expectedRp: (match: ModelMatch) => { red: number; blue: number };
	rules?: RpRules;
};

export type TeamSos = {
	team: number;
	matches: number;
	partner: number;
	opponent: number;
	partnerVsField: number;
	opponentVsField: number;
	expectedRs: number;
	actualRs: number;
	luck: number;
};

export function scheduleStrength(input: SosInput): TeamSos[] {
	const rules = input.rules ?? RP_RULES;
	const played = input.matches.filter(
		(m) => m.level === 'qual' && m.redScore !== null && m.blueScore !== null
	);
	const acc = new Map<
		number,
		{
			partner: number;
			partners: number;
			opponent: number;
			opponents: number;
			expected: number;
			n: number;
		}
	>();
	const field = new Set<number>();
	for (const m of played) {
		const surrogates = new Set(m.surrogates ?? []);
		const expected = input.expectedRp(m);
		for (const own of ['red', 'blue'] as const) {
			const mine = m[own];
			const theirs = m[own === 'red' ? 'blue' : 'red'];
			for (const team of mine) {
				field.add(team);
				if (surrogates.has(team)) continue;
				let a = acc.get(team);
				if (!a) {
					a = { partner: 0, partners: 0, opponent: 0, opponents: 0, expected: 0, n: 0 };
					acc.set(team, a);
				}
				for (const p of mine) {
					if (p === team) continue;
					a.partner += input.rating(p);
					a.partners++;
				}
				for (const o of theirs) {
					a.opponent += input.rating(o);
					a.opponents++;
				}
				a.expected += expected[own];
				a.n++;
			}
		}
	}
	const ratings = [...field].map(input.rating).filter(Number.isFinite);
	const average = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;
	const actual = new Map(tallyResults(played, rules).map((t) => [t.team, t]));
	return [...acc.entries()]
		.map(([team, a]) => {
			const t = actual.get(team);
			const partner = a.partners ? a.partner / a.partners : average;
			const opponent = a.opponents ? a.opponent / a.opponents : average;
			const expectedRs = a.n ? a.expected / a.n : 0;
			const actualRs = t && t.counted ? t.rp / t.counted : 0;
			return {
				team,
				matches: a.n,
				partner,
				opponent,
				partnerVsField: partner - average,
				opponentVsField: opponent - average,
				expectedRs,
				actualRs,
				luck: actualRs - expectedRs
			};
		})
		.sort((x, y) => x.team - y.team);
}
