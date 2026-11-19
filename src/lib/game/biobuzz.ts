import type {
	AllianceScore,
	FlowerElement,
	Flowers,
	MatchResult,
	ScoreBreakdown
} from '#lib/types.ts';

export const SEASON = 2026;

export const GAME_NAME = 'BIOBUZZ';

export const POINTS = {
	leave: 3,
	park: 5,
	tip: 20,
	cellBall: 2,
	bottomNectarBonus: 5,
	flowerBall: 2,
	gardenBall: 1,
	minorFoul: 5,
	majorFoul: 20
} as const;

export const RP_THRESHOLDS = {
	swarm: 16,
	pollinator1: 4,
	pollinator2: 7
} as const;

export const FLOWER_NAMES = [
	'red',
	'blue',
	'scoring',
	'audience'
] as const satisfies (keyof Flowers)[];

export interface BreakdownParts {
	auto: number;
	hive: number;
	flower: number;
	garden: number;
	park: number;
	fouls: number;
}

export function breakdownParts(score: AllianceScore): BreakdownParts {
	const points = score.breakdown?.points;
	if (!points) {
		return { auto: score.auto, hive: 0, flower: 0, garden: 0, park: 0, fouls: score.foulPoints };
	}
	return {
		auto: points.auto,
		hive: points.teleopHive,
		flower: points.teleopFlower,
		garden: points.teleopGarden,
		park: points.teleopPark,
		fouls: score.foulPoints
	};
}

export function flowerOwner(flower: FlowerElement[]): 'red' | 'blue' | null {
	for (let i = flower.length - 1; i >= 0; i--) {
		const element = flower[i];
		if (element !== 'pollen') return element;
	}
	return null;
}

export function bottomNectar(flower: FlowerElement[]): 'red' | 'blue' | null {
	for (const element of flower) {
		if (element !== 'pollen') return element;
	}
	return null;
}

export function flowerPoints(flowers: Flowers, alliance: 'red' | 'blue'): number {
	let points = 0;
	for (const name of FLOWER_NAMES) {
		const flower = flowers[name];
		if (flowerOwner(flower) === alliance) points += flower.length * POINTS.flowerBall;
		if (bottomNectar(flower) === alliance) points += POINTS.bottomNectarBonus;
	}
	return points;
}

export function tips(breakdown: ScoreBreakdown): number {
	return breakdown.auto.tips + breakdown.teleop.tips;
}

export function leaveParkPoints(breakdown: ScoreBreakdown): number {
	const { autoLeave, autoPark, teleopPark } = breakdown.points;
	return autoLeave + autoPark + teleopPark;
}

export function foulPointsFor(opponent: ScoreBreakdown): number {
	return opponent.minorFouls * POINTS.minorFoul + opponent.majorFouls * POINTS.majorFoul;
}

export interface ScoreIssue {
	field: string;
	expected: number | boolean;
	actual: number | boolean;
}

function count(pair: [boolean, boolean]): number {
	return Number(pair[0]) + Number(pair[1]);
}

export function scoreCheck(
	score: AllianceScore,
	opponent: AllianceScore,
	alliance: 'red' | 'blue',
	options: { checkRp?: boolean } = {}
): ScoreIssue[] {
	const breakdown = score.breakdown;
	const opponentBreakdown = opponent.breakdown;
	if (!breakdown || !opponentBreakdown) return [];
	const { auto, teleop, points } = breakdown;
	const issues: ScoreIssue[] = [];
	const check = (field: string, expected: number | boolean, actual: number | boolean) => {
		if (expected !== actual) issues.push({ field, expected, actual });
	};

	const autoLeave = count(auto.leave) * POINTS.leave;
	const autoPark = count(auto.park) * POINTS.park;
	const autoHive = auto.tips * POINTS.tip;
	const autoTotal = autoLeave + autoPark + autoHive;
	const teleopHive = teleop.tips * POINTS.tip + teleop.cellBalls * POINTS.cellBall;
	const teleopFlower = flowerPoints(teleop.flowers, alliance);
	const teleopGarden = teleop.gardenBalls * POINTS.gardenBall;
	const teleopPark = count(teleop.park) * POINTS.park;
	const teleopTotal = teleopHive + teleopFlower + teleopGarden + teleopPark;
	const preFoul = autoTotal + teleopTotal;
	const foulsCommitted = foulPointsFor(breakdown);
	const fouls = foulPointsFor(opponentBreakdown);

	check('autoLeave', autoLeave, points.autoLeave);
	check('autoPark', autoPark, points.autoPark);
	check('autoHive', autoHive, points.autoHive);
	check('auto', points.autoLeave + points.autoPark + points.autoHive, points.auto);
	check('teleopHive', teleopHive, points.teleopHive);
	check('teleopFlower', teleopFlower, points.teleopFlower);
	check('teleopGarden', teleopGarden, points.teleopGarden);
	check('teleopPark', teleopPark, points.teleopPark);
	check(
		'teleop',
		points.teleopHive + points.teleopFlower + points.teleopGarden + points.teleopPark,
		points.teleop
	);
	check('preFoulTotal', points.auto + points.teleop, score.preFoulTotal);
	check('recomputedPreFoulTotal', preFoul, score.preFoulTotal);
	check('foulPointsCommitted', foulsCommitted, breakdown.foulPointsCommitted);
	check('total', score.preFoulTotal + fouls, score.total);

	if (options.checkRp ?? true) {
		const tipCount = tips(breakdown);
		check('swarm', leaveParkPoints(breakdown) >= RP_THRESHOLDS.swarm, breakdown.rp.swarm);
		check('pollinator1', tipCount >= RP_THRESHOLDS.pollinator1, breakdown.rp.pollinator1);
		check('pollinator2', tipCount >= RP_THRESHOLDS.pollinator2, breakdown.rp.pollinator2);
	}

	return issues;
}

export function matchScoreCheck(
	result: MatchResult,
	options: { checkRp?: boolean } = {}
): { red: ScoreIssue[]; blue: ScoreIssue[] } {
	return {
		red: scoreCheck(result.red, result.blue, 'red', options),
		blue: scoreCheck(result.blue, result.red, 'blue', options)
	};
}
