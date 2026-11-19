export type TimedMatch = { key: string; scheduled: number | null; actual: number | null };

export type ScheduleOptions = {
	now?: number;
	window?: number;
	breakFactor?: number;
	maxEarly?: number;
	trust?: number;
	queueMatches?: number;
	defaultCycle?: number;
};

export type StartEstimate = {
	key: string;
	start: number;
	queue: number;
	delay: number | null;
	played: boolean;
};

const MINUTE = 60_000;

export const SCHEDULE_DEFAULTS = {
	window: 6,
	breakFactor: 1.4,
	maxEarly: Infinity,
	trust: 0.5,
	queueMatches: 2,
	defaultCycle: 7 * MINUTE
};

export const PLAYOFF_SCHEDULE: ScheduleOptions = {
	window: 4,
	breakFactor: 3,
	maxEarly: 0,
	trust: 0.25
};

function median(values: number[]): number | null {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function scheduledCycle(matches: TimedMatch[]): number | null {
	const gaps: number[] = [];
	for (let i = 1; i < matches.length; i++) {
		const a = matches[i - 1].scheduled;
		const b = matches[i].scheduled;
		if (a !== null && b !== null && b > a) gaps.push(b - a);
	}
	return median(gaps);
}

export function observedCycle(matches: TimedMatch[], options: ScheduleOptions = {}): number | null {
	const window = options.window ?? SCHEDULE_DEFAULTS.window;
	const sched = scheduledCycle(matches) ?? options.defaultCycle ?? SCHEDULE_DEFAULTS.defaultCycle;
	const limit = sched * (options.breakFactor ?? SCHEDULE_DEFAULTS.breakFactor);
	const gaps: number[] = [];
	for (let i = matches.length - 1; i > 0 && gaps.length < window; i--) {
		const a = matches[i - 1];
		const b = matches[i];
		if (a.actual === null || b.actual === null) continue;
		const plannedGap =
			a.scheduled !== null && b.scheduled !== null ? b.scheduled - a.scheduled : sched;
		const gap = b.actual - a.actual;
		if (plannedGap > limit || gap <= 0 || gap > 3 * limit) continue;
		gaps.push(gap);
	}
	return median(gaps);
}

export function estimateStarts(
	matches: TimedMatch[],
	options: ScheduleOptions = {}
): StartEstimate[] {
	const breakFactor = options.breakFactor ?? SCHEDULE_DEFAULTS.breakFactor;
	const maxEarly = options.maxEarly ?? SCHEDULE_DEFAULTS.maxEarly;
	const trust = options.trust ?? SCHEDULE_DEFAULTS.trust;
	const queueMatches = options.queueMatches ?? SCHEDULE_DEFAULTS.queueMatches;
	const sched = scheduledCycle(matches) ?? options.defaultCycle ?? SCHEDULE_DEFAULTS.defaultCycle;
	let lastPlayed = -1;
	for (let i = 0; i < matches.length; i++) if (matches[i].actual !== null) lastPlayed = i;
	const cycle = observedCycle(matches.slice(0, lastPlayed + 1), options) ?? sched;
	const starts: number[] = [];
	for (let i = 0; i < matches.length; i++) {
		const m = matches[i];
		if (i <= lastPlayed) {
			starts.push(m.actual ?? m.scheduled ?? (i > 0 ? starts[i - 1] + cycle : (options.now ?? 0)));
			continue;
		}
		const prev = i > 0 ? starts[i - 1] : null;
		const prevSched = i > 0 ? matches[i - 1].scheduled : null;
		let start: number;
		if (prev === null) {
			start = m.scheduled ?? options.now ?? 0;
		} else if (m.scheduled === null) {
			start = prev + cycle;
		} else {
			const plannedGap = prevSched !== null ? m.scheduled - prevSched : sched;
			const isBreak = plannedGap > sched * breakFactor;
			const step = isBreak ? cycle : trust * cycle + (1 - trust) * Math.max(plannedGap, 0);
			start = Math.max(prev + step, isBreak ? m.scheduled : m.scheduled - maxEarly);
		}
		if (i === lastPlayed + 1 && options.now !== undefined) start = Math.max(start, options.now);
		starts.push(start);
	}
	return matches.map((m, i) => {
		const q = i - queueMatches;
		return {
			key: m.key,
			start: starts[i],
			queue: q >= 0 ? starts[q] : starts[i] - queueMatches * cycle,
			delay: m.scheduled === null ? null : starts[i] - m.scheduled,
			played: i <= lastPlayed && m.actual !== null
		};
	});
}
