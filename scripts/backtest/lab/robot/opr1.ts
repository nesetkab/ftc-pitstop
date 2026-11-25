import { evaluate } from '../harness.ts';
import { RobotOpr } from './ropr.ts';
import { BASE, data } from './setup.ts';

const list = process.argv.slice(2).map(Number);
const seasonsList = list.length ? list : undefined;
await data(seasonsList);
const direct = { ...BASE, q: 0.15, qWeek: 0.01 };
await evaluate(
	`robot-opr1${list.length ? `-${list.join('-')}` : ''}`,
	[
		new RobotOpr('total', { rest: BASE }),
		new RobotOpr('robot', { rest: BASE, robot: direct }),
		new RobotOpr('robot-split', { rest: BASE, robot: direct, robotSplit: direct }),
		new RobotOpr('robot-auto', { rest: BASE, robot: direct, auto: BASE }),
		new RobotOpr('robot-auto-gate', {
			rest: BASE,
			robot: direct,
			auto: BASE,
			move: direct,
			gate: 0.2
		})
	],
	{ seasons: seasonsList }
);
