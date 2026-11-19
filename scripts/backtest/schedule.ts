import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	estimateStarts,
	PLAYOFF_SCHEDULE,
	SCHEDULE_DEFAULTS,
	type ScheduleOptions,
	type TimedMatch
} from '../../src/lib/model/schedule.ts';
import { loadSeason, type HistMatch } from './hist.ts';

const AHEAD = [1, 2, 3, 5, 10];
const MINUTE = 60_000;
const OUT_PATH = join(import.meta.dirname, '..', '..', 'src', 'lib', 'model', 'accuracy.json');

type Phase = TimedMatch[];

function median(values: number[]): number {
	const s = [...values].sort((a, b) => a - b);
	const mid = s.length >> 1;
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function phases(matches: HistMatch[]): { quals: Phase; playoffs: Phase } {
	const timed = (m: HistMatch): TimedMatch => ({
		key: String(m.id),
		scheduled: m.sched ? Date.parse(m.sched) : null,
		actual: m.actual ? Date.parse(m.actual) : null
	});
	const quals = matches.filter((m) => m.level === 'Quals').sort((a, b) => a.num - b.num);
	const playoffs = matches
		.filter((m) => m.level !== 'Quals')
		.sort((a, b) => a.series - b.series || a.num - b.num);
	return { quals: quals.map(timed), playoffs: playoffs.map(timed) };
}

type Errors = Record<'estimator' | 'scheduled' | 'delay', number[][]>;

function evaluate(list: Phase[], options: ScheduleOptions): Errors {
	const errors: Errors = {
		estimator: AHEAD.map(() => []),
		scheduled: AHEAD.map(() => []),
		delay: AHEAD.map(() => [])
	};
	for (const phase of list) {
		for (let i = 0; i < phase.length - 1; i++) {
			const current = phase[i];
			if (current.actual === null || current.scheduled === null) continue;
			const snapshot = phase.map((m, k) => (k <= i ? m : { ...m, actual: null }));
			const est = estimateStarts(snapshot, { ...options, now: current.actual });
			AHEAD.forEach((n, a) => {
				const j = i + n;
				const target = phase[j];
				if (!target || target.actual === null || target.scheduled === null) return;
				errors.estimator[a].push(Math.abs(est[j].start - target.actual) / MINUTE);
				errors.scheduled[a].push(Math.abs(target.scheduled - target.actual) / MINUTE);
				errors.delay[a].push(
					Math.abs(target.scheduled + (current.actual! - current.scheduled!) - target.actual) /
						MINUTE
				);
			});
		}
	}
	return errors;
}

function summary(errors: Errors) {
	const out: Record<string, number[]> = {};
	for (const [k, v] of Object.entries(errors)) out[k] = v.map((e) => Number(median(e).toFixed(2)));
	return { ...out, n: errors.estimator.map((e) => e.length) };
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const season = await loadSeason(2026);
	const quals: Phase[] = [];
	const playoffs: Phase[] = [];
	for (const event of season.events) {
		const p = phases(event.matches);
		if (p.quals.filter((m) => m.actual !== null).length >= 4) quals.push(p.quals);
		if (p.playoffs.filter((m) => m.actual !== null).length >= 3) playoffs.push(p.playoffs);
	}
	console.log(`events with timed quals: ${quals.length}, with timed playoffs: ${playoffs.length}`);
	const tuneFor = (list: Phase[]) => {
		let best: { options: ScheduleOptions; score: number } | null = null;
		for (const window of [4, 6, 10, 16]) {
			for (const breakFactor of [1.4, 1.6, 2, 3, 5]) {
				for (const maxEarly of [0, 2, 5, 10, 1e6].map((m) => m * MINUTE)) {
					for (const trust of [0, 0.25, 0.5, 0.75, 1]) {
						const options = { window, breakFactor, maxEarly, trust };
						const e = evaluate(list, options);
						const score = e.estimator.slice(0, 4).reduce((s, v) => s + median(v), 0);
						if (!best || score < best.score) best = { options, score };
					}
				}
			}
		}
		return best!.options;
	};
	const tuned = args.includes('--tune');
	if (tuned) {
		console.log('tuned quals', JSON.stringify(tuneFor(quals)));
		console.log('tuned playoffs', JSON.stringify(tuneFor(playoffs)));
	}
	const qualOptions: ScheduleOptions = { ...SCHEDULE_DEFAULTS };
	const playoffOptions: ScheduleOptions = { ...SCHEDULE_DEFAULTS, ...PLAYOFF_SCHEDULE };
	const shown = (o: ScheduleOptions) => ({
		window: o.window,
		breakFactor: o.breakFactor,
		trust: o.trust,
		maxEarlyMinutes: Number.isFinite(o.maxEarly!) ? o.maxEarly! / MINUTE : null
	});
	const result = {
		ahead: AHEAD,
		options: { quals: shown(qualOptions), playoffs: shown(playoffOptions) },
		quals: summary(evaluate(quals, qualOptions)),
		playoffs: summary(evaluate(playoffs, playoffOptions)),
		events: { quals: quals.length, playoffs: playoffs.length }
	};
	console.log(JSON.stringify(result));
	const existing = JSON.parse(await readFile(OUT_PATH, 'utf8').catch(() => '{}'));
	await writeFile(OUT_PATH, `${JSON.stringify({ ...existing, schedule: result })}\n`);
}

await main();
