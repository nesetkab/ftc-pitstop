import type { SeasonModel } from '#lib/analysis/season.ts';
import type { TeamSeason } from '#lib/types.ts';

export interface TrendPoint {
	code: string;
	event: string;
	start: string;
	opr: number;
}

export interface TrendLine {
	number: number;
	points: TrendPoint[];
}

const points = (value: number) => Math.round(value * 100) / 100 || 0;

export function seasonTrend(
	model: Pick<SeasonModel, 'events' | 'run'>,
	seasons: TeamSeason[]
): TrendLine[] {
	const names = new Map(
		seasons.flatMap((season) =>
			season.events.map((entry) => [entry.event.code, entry.event.name] as const)
		)
	);
	return seasons.map((season) => {
		const number = season.team.number;
		const line: TrendPoint[] = [];
		for (const event of model.events) {
			const rater = model.run.events.get(event.code)?.rater;
			if (!rater || rater.matchesPlayed(number) === 0) continue;
			line.push({
				code: event.code,
				event: names.get(event.code) ?? event.code,
				start: event.start,
				opr: points(rater.value(number))
			});
		}
		return { number, points: line };
	});
}
