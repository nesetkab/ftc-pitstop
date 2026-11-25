import type { Ctx } from './lib.ts';

export type Cols = {
	m: Float64Array;
	sd: Float64Array;
	vf: Float64Array;
	unc: Float64Array;
	lvl: Float64Array;
	po: Float64Array;
	off: Float64Array;
	champ: Float64Array;
	week: Float64Array;
	evPenN: Float64Array;
	evPenVar: Float64Array;
	sePenVar: Float64Array;
	evResN: Float64Array;
	evResVar: Float64Array;
	seResVar: Float64Array;
	cons: Float64Array;
	carry: Float64Array;
	minPlayed: Float64Array;
	newTeams: Float64Array;
	first: Float64Array;
};

export function columns(c: Ctx, k = 0): Cols {
	const n = c.rec.n;
	const mk = () => new Float64Array(n);
	const out: Cols = {
		m: mk(),
		sd: mk(),
		vf: mk(),
		unc: mk(),
		lvl: mk(),
		po: mk(),
		off: mk(),
		champ: mk(),
		week: mk(),
		evPenN: mk(),
		evPenVar: mk(),
		sePenVar: mk(),
		evResN: mk(),
		evResVar: mk(),
		seResVar: mk(),
		cons: mk(),
		carry: mk(),
		minPlayed: mk(),
		newTeams: mk(),
		first: mk()
	};
	let gPen = 0;
	let gPenN = 0;
	let gRes = 0;
	let gResN = 0;
	for (const r of c.train) {
		if (c.f(r, 'sePenN') > 0) {
			gPen += c.f(r, 'sePenSS') / c.f(r, 'sePenN');
			gPenN++;
		}
		if (c.f(r, 'seResN') > 0) {
			gRes += c.f(r, 'seResSS') / c.f(r, 'seResN');
			gResN++;
		}
	}
	gPen /= gPenN;
	gRes /= gResN;
	for (let r = 0; r < n; r++) {
		const red = c.pred(k, r, 0);
		const blue = c.pred(k, r, 1);
		const mean = c.rec.mean[r];
		out.m[r] = red - blue;
		out.sd[r] = c.rec.sd[r];
		out.vf[r] = c.pred(k, r, 2);
		out.unc[r] = c.rec.unc[r];
		out.lvl[r] = mean > 0 ? Math.min(Math.max((red + blue) / (2 * mean), 0.25), 4) : 1;
		out.po[r] = c.rec.playoff[r];
		out.off[r] = c.rec.official[r];
		const type = c.f(r, 'type');
		out.champ[r] = type === 3 || type === 4 || type === 5 || type === 6 ? 1 : 0;
		out.week[r] = c.f(r, 'week');
		const sePenN = c.f(r, 'sePenN');
		const sePen = sePenN > 20 ? c.f(r, 'sePenSS') / sePenN : gPen;
		out.sePenVar[r] = sePen;
		out.evPenN[r] = c.f(r, 'evPenN');
		out.evPenVar[r] = c.f(r, 'evPenSS');
		const seResN = c.f(r, 'seResN');
		out.seResVar[r] = seResN > 40 ? c.f(r, 'seResSS') / seResN : gRes;
		out.evResN[r] = c.f(r, 'evResN');
		out.evResVar[r] = c.f(r, 'evResSS');
		const rc = c.f(r, 'redCons');
		const bc = c.f(r, 'blueCons');
		out.cons[r] = Number.isFinite(rc) && Number.isFinite(bc) ? (rc + bc) / 2 : out.seResVar[r];
		const sd = c.rec.sd[r] || 1;
		out.carry[r] = (c.f(r, 'redHi') - c.f(r, 'redLo') - (c.f(r, 'blueHi') - c.f(r, 'blueLo'))) / sd;
		out.minPlayed[r] = c.f(r, 'minPlayed');
		out.newTeams[r] = c.f(r, 'newToSeason');
		out.first[r] = c.f(r, 'firstEvent');
	}
	return out;
}
