import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Blend } from '../../models.ts';
import { TRAIN } from '../harness.ts';
import { trainLoss } from './setup.ts';
import { VARIANTS } from './variants.ts';

const [a, b] = process.argv.slice(2);
const load = (n: string) => JSON.parse(readFileSync(join(import.meta.dirname, 'params', `${n}.json`), 'utf8'));
const weights = [1, 0.9, 0.8, 0.7, 0.5];
const models = weights.map(
	(w) => new Blend(`w=${w}`, VARIANTS[a].make(load(a), a), VARIANTS[b].make(load(b), b), w)
);
const losses = await trainLoss(models, TRAIN);
console.log(weights.map((w, i) => `${w}=${losses[i].toFixed(5)}`).join(' '));
