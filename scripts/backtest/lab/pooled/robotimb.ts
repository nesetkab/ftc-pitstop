import type { Ctx, Pred } from '../../models.ts';
import type { PMatch } from '../../prep.ts';
import { RobotOpr, type RoprOpts } from '../robot/ropr.ts';

export class ImbRobotOpr extends RobotOpr {
	imbPred: number;
	imbFit: number;

	constructor(name: string, o: RoprOpts, imbPred: number, imbFit: number) {
		super(name, o);
		this.imbPred = imbPred;
		this.imbFit = imbFit;
		const rest = this.rest;
		const observe = rest.observe.bind(rest);
		rest.observe = (idx: number[], h: number[], y: number, r = 1) => {
			if (this.imbFit === 0 || idx.length !== 2) return observe(idx, h, y, r);
			const sgn = Math.sign(rest.nu[idx[0]] - rest.nu[idx[1]]);
			observe(idx, [h[0] * (1 + this.imbFit * sgn), h[1] * (1 - this.imbFit * sgn)], y, r);
		};
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		const out = super.predict(m, ctx);
		const c = this.imbPred;
		if (c === 0) return out;
		const gap = (teams: number[], score: boolean) => {
			if (teams.length !== 2) return 0;
			const v = score ? this.rest.nu : this.rest.mu;
			return Math.abs(v[this.rest.at(teams[0])] - v[this.rest.at(teams[1])]);
		};
		return {
			...out,
			red: out.red + c * gap(m.red, false),
			blue: out.blue + c * gap(m.blue, false),
			redScore: out.redScore + c * gap(m.red, true),
			blueScore: out.blueScore + c * gap(m.blue, true)
		};
	}
}
