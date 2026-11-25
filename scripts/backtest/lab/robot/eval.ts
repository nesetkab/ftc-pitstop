import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate } from '../harness.ts';
import { data } from './setup.ts';
import { VARIANTS } from './variants.ts';

const args = process.argv.slice(2);
const list = args.filter((a) => /^\d{4}$/.test(a)).map(Number);
const names = args.filter((a) => !/^\d{4}$/.test(a));
const seasonsList = list.length ? list : undefined;
await data(seasonsList);

function load(name: string): Record<string, unknown> {
	const [base, file] = name.split('@');
	try {
		return JSON.parse(
			readFileSync(join(import.meta.dirname, 'params', `${file ?? base}.json`), 'utf8')
		);
	} catch {
		return VARIANTS[base].start;
	}
}

await evaluate(
	`robot-${names.join('+')}${list.length ? `-${list.join('-')}` : ''}`,
	names.map((n) => VARIANTS[n.split('@')[0]].make(load(n), n)),
	{ seasons: seasonsList }
);
