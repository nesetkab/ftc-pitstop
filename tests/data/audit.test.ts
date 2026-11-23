import { describe, expect, it } from 'vitest';
import { fixtureBundle } from '#lib/components/pit/fixtures.ts';
import { RP_RULES } from '#lib/model/rp.ts';
import type { AllianceColor, EventBundle, Match } from '#lib/types.ts';
import { leastSquaresOpr } from '../../scripts/audit/compare.ts';
import { scoutFixture } from './helpers.ts';

type ScoutAlliance = Record<string, number>;

interface Snapshot {
	code: string;
	teams: {
		team: number;
		rank: number;
		rp: number;
		tb1: number;
		wins: number;
		losses: number;
		ties: number;
		qualMatchesPlayed: number;
		opr: { totalPointsNp: number } | null;
	}[];
	matches: { key: string; red: ScoutAlliance; blue: ScoutAlliance }[];
}

const EVENTS: Record<string, string> = {
	AUPYQ: 'AUPYQ',
	USMTBUQ: 'USMTBUQ-final',
	UZTAQ1: 'UZTAQ1',
	USFLORM1: 'USFLORM1'
};

const PARTS: [string, (side: Match['result'] & object, color: AllianceColor) => number][] = [
	['totalPoints', (r, c) => r[c].total],
	['totalPointsNp', (r, c) => r[c].preFoulTotal],
	['autoPoints', (r, c) => r[c].auto],
	['dcPoints', (r, c) => r[c].teleop],
	['penaltyPointsByOpp', (r, c) => r[c].foulPoints],
	['autoLeavePoints', (r, c) => r[c].breakdown!.points.autoLeave],
	['autoParkPoints', (r, c) => r[c].breakdown!.points.autoPark],
	['autoHivePoints', (r, c) => r[c].breakdown!.points.autoHive],
	['dcHivePoints', (r, c) => r[c].breakdown!.points.teleopHive],
	['dcFlowerPoints', (r, c) => r[c].breakdown!.points.teleopFlower],
	['dcGardenPoints', (r, c) => r[c].breakdown!.points.teleopGarden],
	['dcParkPoints', (r, c) => r[c].breakdown!.points.teleopPark],
	['majorsCommitted', (r, c) => r[c].breakdown!.majorFouls],
	['minorsCommitted', (r, c) => r[c].breakdown!.minorFouls]
];

function qualTotals(bundle: EventBundle, team: number) {
	let rp = 0;
	let np = 0;
	for (const match of bundle.matches) {
		if (match.level !== 'qual' || !match.result) continue;
		for (const color of ['red', 'blue'] as const) {
			const seat = match[color].find((entry) => entry.team === team && !entry.surrogate);
			if (!seat || seat.dq || seat.noShow) continue;
			const { winner } = match.result;
			const own = match.result[color];
			const bonus = own.breakdown?.rp;
			rp += winner === color ? RP_RULES.win : winner === null ? RP_RULES.tie : 0;
			rp += bonus ? Number(bonus.swarm) + Number(bonus.pollinator1) + Number(bonus.pollinator2) : 0;
			np += own.preFoulTotal;
		}
	}
	return { rp, np };
}

describe.each(Object.entries(EVENTS))('audit against FTCScout: %s', (code, dir) => {
	const bundle = fixtureBundle(dir);
	const snapshot = scoutFixture<Snapshot>(`audit-${code}`);
	const scout = new Map(snapshot.teams.map((entry) => [entry.team, entry]));

	it('has the same score and every score part for each played match', () => {
		const played = bundle.matches.filter((match) => match.result);
		expect(played.length).toBe(snapshot.matches.length);
		const byKey = new Map(snapshot.matches.map((match) => [match.key, match]));
		for (const match of played) {
			const other = byKey.get(match.key)!;
			for (const color of ['red', 'blue'] as const) {
				for (const [field, get] of PARTS) {
					expect([match.key, color, field, get(match.result!, color)]).toEqual([
						match.key,
						color,
						field,
						other[color][field]
					]);
				}
			}
		}
	});

	it('has the same qualification record for every team', () => {
		for (const row of bundle.rankings) {
			const other = scout.get(row.team)!;
			expect([row.team, row.wins, row.losses, row.ties]).toEqual([
				row.team,
				other.wins,
				other.losses,
				other.ties
			]);
		}
	});

	it('matches FIRST RS and TBP when disqualified and missed matches count as zero', () => {
		for (const row of bundle.rankings) {
			const { rp, np } = qualTotals(bundle, row.team);
			const matches = bundle.event.type === 'LeagueMeet' ? row.counted! : row.played;
			expect(rp / matches).toBeCloseTo(row.rs, 3);
			expect(np / matches).toBeCloseTo(row.tbp, 3);
		}
	});

	it('finds FTCScout event OPR is least squares over qualification scores without penalties', () => {
		const opr = leastSquaresOpr(
			bundle.matches.filter((match) => match.level === 'qual' && match.result),
			'np'
		);
		for (const entry of snapshot.teams) {
			if (!entry.opr) continue;
			expect(opr.get(entry.team)).toBeCloseTo(entry.opr.totalPointsNp, 2);
		}
	});
});

describe('where FTCScout differs from FIRST', () => {
	it('still credits a team disqualified from every match, so PitStop keeps the FIRST order', () => {
		const bundle = fixtureBundle('UZTAQ1');
		const scout = scoutFixture<Snapshot>('audit-UZTAQ1');
		const first = bundle.rankings.find((row) => row.team === 35580)!;
		const other = scout.teams.find((entry) => entry.team === 35580)!;
		expect([first.rank, first.rs, first.tbp]).toEqual([11, 0, 0]);
		expect(other.rank).toBe(6);
		expect(other.rp).toBeGreaterThan(0);
	});

	it('divides league meet RS by matches played instead of the counted matches', () => {
		const bundle = fixtureBundle('USFLORM1');
		const scout = scoutFixture<Snapshot>('audit-USFLORM1');
		const first = bundle.rankings[0];
		const other = scout.teams.find((entry) => entry.team === first.team)!;
		expect(first.counted).toBe(10);
		expect(first.played).toBe(5);
		expect(other.rp).toBeCloseTo(first.rs * 2, 3);
	});
});
