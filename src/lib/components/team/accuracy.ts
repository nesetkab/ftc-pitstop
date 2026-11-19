export interface ModelMetrics {
	brier: number;
	logloss: number;
	accuracy: number;
	mae: number;
}

export interface ModelInfo {
	id: string;
	label: string;
}

export interface SeasonResult {
	season: number;
	game: string;
	split: string;
	n: number;
	models: Record<string, ModelMetrics>;
}

export interface CalibrationBin {
	lo: number;
	hi: number;
	n: number;
	predicted: number;
	observed: number;
}

export interface RpResult {
	n: number;
	brier: number;
	logloss: number;
	rate: number;
	calibration: CalibrationBin[];
}

export interface ScheduleErrors {
	estimator: number[];
	scheduled: number[];
	delay: number[];
	n: number[];
}

export interface AccuracyReport {
	generatedAt: string;
	method: { train: number[]; validation: number[]; test: number[]; note?: string };
	chosen: { id: string; label: string };
	models: ModelInfo[];
	seasons: SeasonResult[];
	calibration?: { model?: string; validation?: CalibrationBin[]; test?: CalibrationBin[] };
	rp?: {
		season: number;
		alliances: number;
		swarm?: RpResult;
		pollinator1?: RpResult;
		pollinator2?: RpResult;
	};
	schedule?: {
		ahead: number[];
		quals?: ScheduleErrors;
		playoffs?: ScheduleErrors;
		events?: { quals: number; playoffs: number };
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAccuracyReport(value: unknown): value is AccuracyReport {
	if (!isRecord(value)) return false;
	return (
		typeof value.generatedAt === 'string' &&
		isRecord(value.method) &&
		isRecord(value.chosen) &&
		typeof value.chosen.id === 'string' &&
		Array.isArray(value.models) &&
		Array.isArray(value.seasons) &&
		value.seasons.length > 0
	);
}

export function seasonRange(years: number[]): string {
	const sorted = [...years].sort((a, b) => a - b);
	if (sorted.length === 0) return '';
	if (sorted.length === 1) return String(sorted[0]);
	const contiguous = sorted.every((year, index) => index === 0 || year === sorted[index - 1] + 1);
	if (contiguous) {
		return sorted.length === 2
			? `${sorted[0]} and ${sorted[1]}`
			: `${sorted[0]} to ${sorted[sorted.length - 1]}`;
	}
	return `${sorted.slice(0, -1).join(', ')} and ${sorted[sorted.length - 1]}`;
}

export function splitNote(split: string): string {
	if (split === 'train') return 'Used to set parameters';
	if (split === 'validation') return 'Used to choose the model';
	if (split === 'test') return 'Not used for tuning';
	return '';
}

export function baseRateBrier(rate: number): number {
	return rate * (1 - rate);
}

function sameMetrics(a: ModelMetrics | undefined, b: ModelMetrics | undefined): boolean {
	return Boolean(
		a &&
		b &&
		a.brier === b.brier &&
		a.logloss === b.logloss &&
		a.accuracy === b.accuracy &&
		a.mae === b.mae
	);
}

function trimRp(result: RpResult | undefined): RpResult | undefined {
	if (!result) return undefined;
	const { n, brier, logloss, rate, calibration } = result;
	return { n, brier, logloss, rate, calibration };
}

function trimErrors(errors: ScheduleErrors | undefined): ScheduleErrors | undefined {
	if (!errors) return undefined;
	const { estimator, scheduled, delay, n } = errors;
	return { estimator, scheduled, delay, n };
}

export function prepareReport(report: AccuracyReport): AccuracyReport {
	const chosen = report.chosen.id;
	const models = report.models.filter(
		(model) =>
			model.id === chosen ||
			!report.seasons.every((season) => sameMetrics(season.models[model.id], season.models[chosen]))
	);
	const { method, calibration, rp, schedule } = report;
	return {
		generatedAt: report.generatedAt,
		method: { train: method.train, validation: method.validation, test: method.test },
		chosen: { id: chosen, label: report.chosen.label },
		models: models.map(({ id, label }) => ({ id, label })),
		seasons: report.seasons.map(({ season, game, split, n, models: results }) => ({
			season,
			game,
			split,
			n,
			models: Object.fromEntries(
				models.flatMap((model) => (results[model.id] ? [[model.id, results[model.id]]] : []))
			)
		})),
		calibration: calibration && {
			model: calibration.model,
			validation: calibration.validation,
			test: calibration.test
		},
		rp: rp && {
			season: rp.season,
			alliances: rp.alliances,
			swarm: trimRp(rp.swarm),
			pollinator1: trimRp(rp.pollinator1),
			pollinator2: trimRp(rp.pollinator2)
		},
		schedule: schedule && {
			ahead: schedule.ahead,
			quals: trimErrors(schedule.quals),
			playoffs: trimErrors(schedule.playoffs),
			events: schedule.events
		}
	};
}
