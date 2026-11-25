import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seasons } from '../harness.ts';
import { allianceCheck, attach, type RMatch } from './data.ts';

const ROBOT_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '.cache', 'robot');
const list = process.argv.slice(2).map(Number);

for (const s of list) {
	const path = join(ROBOT_ROOT, `${s}.json`);
	if (s < 2026 && existsSync(path)) {
		const data = JSON.parse(readFileSync(path, 'utf8')) as Record<
			string,
			[Record<string, unknown>, Record<string, unknown>]
		>;
		let n = 0;
		let bad = 0;
		const examples: string[] = [];
		for (const [key, [r, b]] of Object.entries(data)) {
			for (const x of [r, b]) {
				const [mine, theirs] = allianceCheck(s, x);
				n++;
				if (mine !== theirs) {
					bad++;
					if (examples.length < 3) examples.push(`${key} ${mine} ${theirs} ${JSON.stringify(x)}`);
				}
			}
		}
		console.log(s, 'alliances', n, 'mismatch', bad);
		for (const e of examples) console.log('  ', e);
	}
	const [events] = await seasons([s]);
	attach([events]);
	let total = 0;
	let have = 0;
	let robotPts = 0;
	let np = 0;
	let autoR = 0;
	let auto = 0;
	let moved = 0;
	let robots = 0;
	const byTeam = new Map<number, [number, number][]>();
	for (const e of events) {
		for (const m of e.matches as RMatch[]) {
			for (const [sd, teams, y] of [
				[m.red2, m.red, m.redNp],
				[m.blue2, m.blue, m.blueNp]
			] as const) {
				total++;
				if (!sd) continue;
				have++;
				np += y;
				auto += sd.auto;
				for (let i = 0; i < sd.ra.length; i++) {
					robotPts += sd.ra[i] + sd.re[i];
					autoR += sd.ra[i];
					moved += sd.mv[i];
					robots++;
					const list = byTeam.get(teams[i]) ?? [];
					list.push([sd.mv[i], sd.ra[i] + sd.re[i]]);
					byTeam.set(teams[i], list);
				}
			}
		}
	}
	let same = 0;
	let other = 0;
	let cnt = 0;
	for (const v of byTeam.values()) {
		if (v.length < 6) continue;
		const h = v.length >> 1;
		const a = v.slice(0, h).reduce((t, x) => t + x[1], 0) / h;
		const b = v.slice(h).reduce((t, x) => t + x[1], 0) / (v.length - h);
		same += a * b;
		other += a * a + b * b;
		cnt++;
	}
	console.log(
		s,
		`alliances ${total} with detail ${have}`,
		`robot share of np ${(robotPts / np).toFixed(3)}`,
		`robot auto share of auto ${(autoR / auto).toFixed(3)}`,
		`move rate ${(moved / robots).toFixed(3)}`,
		`split-half corr ${((2 * same) / other).toFixed(3)} teams ${cnt}`
	);
}
