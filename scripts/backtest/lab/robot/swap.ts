import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seasons } from '../harness.ts';
import { robotOf } from './data.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '.cache', 'robot');

function share(mp: Map<number, number[]>): number {
	let within = 0;
	const all: number[] = [];
	for (const v of mp.values()) {
		if (v.length < 5) continue;
		const mu = v.reduce((a, b) => a + b, 0) / v.length;
		within += v.reduce((a, b) => a + (b - mu) ** 2, 0);
		all.push(...v);
	}
	const mu = all.reduce((a, b) => a + b, 0) / all.length;
	const total = all.reduce((a, b) => a + (b - mu) ** 2, 0);
	return 1 - within / total;
}

for (const s of process.argv.slice(2).map(Number)) {
	const [events] = await seasons([s]);
	const path = join(ROOT, `${s}.json`);
	const raw = s < 2026 && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
	const acc = [new Map<number, number[]>(), new Map<number, number[]>()];
	for (const e of events) {
		for (const m of e.matches) {
			const r = s >= 2026 ? [m.rs, m.bs] : raw[`${e.code}:${m.id}`];
			if (!r) continue;
			const sides = [
				[m.red, m.redSt, r[0]],
				[m.blue, m.blueSt, r[1]]
			] as const;
			for (const [teams, st, x] of sides) {
				teams.forEach((t, i) => {
					for (const swap of [0, 1]) {
						const k = st[i] === 2 !== (swap === 1) ? 2 : 1;
						const v = robotOf(s, x, k);
						const list = acc[swap].get(t) ?? [];
						list.push(v.ra + v.re);
						acc[swap].set(t, list);
					}
				});
			}
		}
	}
	console.log(s, 'R2 station1=robot1', share(acc[0]).toFixed(3), 'swapped', share(acc[1]).toFixed(3));
}
