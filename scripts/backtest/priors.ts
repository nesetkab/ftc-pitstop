import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HISTORY, packPrevious } from '../../src/lib/model/opr.ts';
import { previousFor } from './production.ts';

const SEASON = Number(process.argv[2] ?? 2026);
const OUT = join(
	import.meta.dirname,
	'..',
	'..',
	'src',
	'lib',
	'model',
	`previous-${SEASON - 1}.json`
);

const { previous, base } = await previousFor(SEASON);
const from = HISTORY.map((_, k) => SEASON - 1 - k).filter((s) => s >= 2021);
const packed = {
	season: SEASON - 1,
	for: SEASON,
	from,
	history: HISTORY,
	base,
	...packPrevious(previous)
};
await writeFile(OUT, `${JSON.stringify(packed)}\n`);
console.log(`wrote ${OUT}: ${previous.size} teams, base ${JSON.stringify(base)}`);
