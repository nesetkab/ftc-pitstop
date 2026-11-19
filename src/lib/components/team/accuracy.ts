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
