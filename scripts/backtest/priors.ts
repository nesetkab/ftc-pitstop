import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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

const previous = await previousFor(SEASON);
const teams = Object.fromEntries(
	[...previous].sort((a, b) => a[0] - b[0]).map(([team, rel]) => [team, Number(rel.toFixed(3))])
);
await writeFile(OUT, `${JSON.stringify({ season: SEASON - 1, for: SEASON, teams })}\n`);
console.log(`wrote ${OUT}: ${previous.size} teams`);
