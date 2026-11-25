import { evaluate } from '../harness.ts';
import { data as robotData } from '../robot/setup.ts';
import { make } from './variants.ts';

const args = process.argv.slice(2);
const flag = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const names = args.filter((a) => !a.startsWith('--'));
const label = flag('label') ?? `pooled-${names.join('+')}`;
const seasons = flag('seasons')?.split(',').map(Number);
await robotData(seasons);
const extra = flag('extra') ? JSON.parse(flag('extra')!) : {};
await evaluate(
	label,
	names.map((n) => make(n, extra)),
	{ seasons, withShipped: !args.includes('--no-shipped') }
);
