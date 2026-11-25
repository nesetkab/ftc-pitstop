import { KalmanOpr, type Ctx, type OprParams, type Pred } from '../../models.ts';
import type { PEvent, PMatch } from '../../prep.ts';

export const FEATURES = [
	'redHi',
	'redLo',
	'blueHi',
	'blueLo',
	'redVar',
	'blueVar',
	'minPlayed',
	'maxPlayed',
	'newToSeason',
	'firstEvent',
	'week',
	'type',
	'redPen',
	'bluePen',
	'evPenN',
	'evPenS',
	'evPenSS',
	'sePenN',
	'sePenS',
	'sePenSS',
	'redCons',
	'blueCons',
	'consN',
	'event',
	'eventTeams',
	'matchIdx',
	'redSize',
	'blueSize',
	'redEvents',
	'blueEvents',
	'evResN',
	'evResSS',
	'seResN',
	'seResSS',
	'redUnplayed',
	'blueUnplayed',
	'redLoUnplayed',
	'blueLoUnplayed',
	'redLoNew',
	'blueLoNew'
] as const;

export const F = Object.fromEntries(FEATURES.map((k, i) => [k, i])) as Record<
	(typeof FEATURES)[number],
	number
>;

export const TYPES = [
	'LeagueMeet',
	'Qualifier',
	'LeagueTournament',
	'Championship',
	'FIRSTChampionship',
	'SuperQualifier',
	'Premier',
	'Scrimmage',
	'OffSeason'
];

type Resid = { n: number; ss: number };
type Sums = { n: number; s: number; ss: number };

export class ProbeOpr extends KalmanOpr {
	features = new Map<string, Float64Array>();
	season = 0;
	seasonStart = -1;
	event: PEvent | null = null;
	eventCount = 0;
	matchIdx = 0;
	evPen: Sums = { n: 0, s: 0, ss: 0 };
	sePen: Sums = { n: 0, s: 0, ss: 0 };
	evRes: Sums = { n: 0, s: 0, ss: 0 };
	seRes: Sums = { n: 0, s: 0, ss: 0 };
	resid = new Map<number, Resid>();
	events = new Map<number, number>();

	constructor(name: string, p: OprParams) {
		super(name, p);
	}

	startSeason(prevRel: Map<number, number>): void {
		super.startSeason(prevRel);
		this.seasonStart = -1;
		this.sePen = { n: 0, s: 0, ss: 0 };
		this.seRes = { n: 0, s: 0, ss: 0 };
		this.resid = new Map();
		this.events = new Map();
	}

	startEvent(event: PEvent, ctx: Ctx): void {
		super.startEvent(event, ctx);
		if (this.seasonStart < 0) this.seasonStart = event.day;
		this.season = event.season;
		this.event = event;
		this.eventCount++;
		this.matchIdx = 0;
		this.evPen = { n: 0, s: 0, ss: 0 };
		this.evRes = { n: 0, s: 0, ss: 0 };
	}

	predict(m: PMatch, ctx: Ctx): Pred {
		const pred = super.predict(m, ctx);
		const n = this.n;
		const f = new Float64Array(FEATURES.length);
		const mus = (ts: number[]) => ts.map((t) => this.value(t, ctx, false)).sort((a, b) => b - a);
		const r = mus(m.red);
		const b = mus(m.blue);
		f[F.redHi] = r[0];
		f[F.redLo] = r[r.length - 1];
		f[F.blueHi] = b[0];
		f[F.blueLo] = b[b.length - 1];
		const pv = (ts: number[]) =>
			ts.reduce((s, t) => {
				const i = this.index.get(t)!;
				return s + this.P[i * n + i];
			}, 0);
		f[F.redVar] = pv(m.red);
		f[F.blueVar] = pv(m.blue);
		const all = [...m.red, ...m.blue];
		const played = all.map((t) => this.played[this.index.get(t)!]);
		f[F.minPlayed] = Math.min(...played);
		f[F.maxPlayed] = Math.max(...played);
		f[F.newToSeason] = all.filter((t) => !this.teams.has(t) && !this.prevRel.has(t)).length;
		f[F.firstEvent] = all.filter((t) => !this.teams.has(t)).length;
		f[F.week] = (ctx.day - this.seasonStart) / 7;
		f[F.type] = TYPES.indexOf(this.event!.type);
		f[F.redPen] = m.redTotal - m.redNp;
		f[F.bluePen] = m.blueTotal - m.blueNp;
		f[F.evPenN] = this.evPen.n;
		f[F.evPenS] = this.evPen.s;
		f[F.evPenSS] = this.evPen.ss;
		f[F.sePenN] = this.sePen.n;
		f[F.sePenS] = this.sePen.s;
		f[F.sePenSS] = this.sePen.ss;
		const cons = (ts: number[]) =>
			ts.reduce((s, t) => {
				const x = this.resid.get(t);
				return s + (x && x.n > 0 ? x.ss / x.n : NaN);
			}, 0) / ts.length;
		f[F.redCons] = cons(m.red);
		f[F.blueCons] = cons(m.blue);
		f[F.consN] = Math.min(...all.map((t) => this.resid.get(t)?.n ?? 0));
		f[F.event] = this.eventCount;
		f[F.eventTeams] = n;
		f[F.matchIdx] = this.matchIdx;
		f[F.redSize] = m.red.length;
		f[F.blueSize] = m.blue.length;
		f[F.redEvents] = m.red.reduce((s, t) => s + (this.events.get(t) ?? 0), 0);
		f[F.blueEvents] = m.blue.reduce((s, t) => s + (this.events.get(t) ?? 0), 0);
		f[F.evResN] = this.evRes.n;
		f[F.evResSS] = this.evRes.ss;
		f[F.seResN] = this.seRes.n;
		f[F.seResSS] = this.seRes.ss;
		const unplayed = (ts: number[]) =>
			ts.filter((t) => this.played[this.index.get(t)!] === 0).length;
		f[F.redUnplayed] = unplayed(m.red);
		f[F.blueUnplayed] = unplayed(m.blue);
		const lowest = (ts: number[]) =>
			ts.reduce((a, t) => (this.value(t, ctx, false) < this.value(a, ctx, false) ? t : a));
		const rl = lowest(m.red);
		const bl = lowest(m.blue);
		f[F.redLoUnplayed] = this.played[this.index.get(rl)!] === 0 ? 1 : 0;
		f[F.blueLoUnplayed] = this.played[this.index.get(bl)!] === 0 ? 1 : 0;
		f[F.redLoNew] = this.teams.has(rl) ? 0 : 1;
		f[F.blueLoNew] = this.teams.has(bl) ? 0 : 1;
		this.features.set(`${this.season}:${m.key}`, f);
		return pred;
	}

	update(m: PMatch, ctx: Ctx): void {
		const sum = (ts: number[]) => ts.reduce((s, t) => s + this.mu[this.index.get(t)!], 0);
		const sd = ctx.sd > 0 ? ctx.sd : 1;
		const track = (ts: number[], y: number, ok: boolean) => {
			if (!ok) return;
			const e = (y - sum(ts)) / sd;
			this.evRes.n++;
			this.evRes.ss += e * e;
			for (const t of ts) {
				const x = this.resid.get(t) ?? { n: 0, ss: 0 };
				x.n++;
				x.ss += e * e;
				this.resid.set(t, x);
			}
		};
		track(m.redUpd, m.redNp, m.redOk);
		track(m.blueUpd, m.blueNp, m.blueOk);
		const pen = (m.redTotal - m.redNp - (m.blueTotal - m.blueNp)) / sd;
		this.evPen.n++;
		this.evPen.s += pen;
		this.evPen.ss += pen * pen;
		this.matchIdx++;
		super.update(m, ctx);
	}

	endEvent(event: PEvent, ctx: Ctx): void {
		super.endEvent(event, ctx);
		this.sePen.n += this.evPen.n;
		this.sePen.s += this.evPen.s;
		this.sePen.ss += this.evPen.ss;
		this.seRes.n += this.evRes.n;
		this.seRes.ss += this.evRes.ss;
		for (const [t, i] of this.index)
			if (this.played[i] > 0) this.events.set(t, (this.events.get(t) ?? 0) + 1);
	}
}
