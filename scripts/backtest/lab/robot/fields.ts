import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { HIST_ROOT, loadSeason } from '../../hist.ts';

for (const s of [2021, 2022, 2023, 2024, 2025, 2026]) {
	if (!existsSync(join(HIST_ROOT, `${s}.json`))) {
		console.log(s, 'missing');
		continue;
	}
	const d = await loadSeason(s);
	console.log(s, JSON.stringify(d.fields));
	const m = d.events.flatMap((e) => e.matches).find((x) => x.rs && x.level === 'Quals');
	console.log(JSON.stringify(m));
}
