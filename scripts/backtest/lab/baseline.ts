import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build, CANDIDATES } from '../candidates.ts';
import type { EpaParams, OprParams } from '../models.ts';
import { evaluate } from './harness.ts';

const stored = JSON.parse(
	await readFile(join(import.meta.dirname, '..', 'params.json'), 'utf8')
) as {
	candidates: Record<string, OprParams | EpaParams>;
};
await evaluate(
	'baseline',
	CANDIDATES.map((c) => build(c, stored.candidates[c.id]))
);
