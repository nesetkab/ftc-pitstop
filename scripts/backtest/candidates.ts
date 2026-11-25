import {
	HISTORY,
	OPR_PARAMS,
	type CompParams,
	type OprParams as RobotParams
} from '../../src/lib/model/opr.ts';
import { FinalOpr } from './lab/final/heads.ts';
import type { CompParams as LabComp } from './lab/robot/comp.ts';
import { Blend, Epa, KalmanOpr, type EpaParams, type Model, type OprParams } from './models.ts';

export type Family = 'opr' | 'epa' | 'robot';

export type Params = OprParams | EpaParams | RobotParams;

export type Candidate = {
	id: string;
	label: string;
	family: Family;
	base: Params;
	space: Record<string, number[]>;
	scoreSpace?: Record<string, number[]>;
	tie?: Record<string, string>;
};

const SCORE_SPACE = {
	rhoNewScore: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
	rhoPrevScore: [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1]
};

export const PLAIN: OprParams = {
	lamNew: 1e-3,
	lamPrevSeason: 1e-3,
	q: 1e3,
	qMatch: 0,
	carry: 1,
	drift: 0,
	beta: 0,
	rhoNew: 1,
	rhoPrev: 1,
	minMatches: 2,
	fallback: 'mean',
	sobs: 0.8,
	huber: Infinity,
	qWeek: 0,
	history: true
};

export const MAP_BASE: OprParams = {
	lamNew: 1.6,
	lamPrevSeason: 2,
	q: 0.05,
	qMatch: 0,
	carry: 0.9,
	drift: 0.75,
	beta: 0.6,
	rhoNew: 0.2,
	rhoPrev: 0.4,
	minMatches: 0,
	fallback: 'prior',
	sobs: 0.8,
	huber: Infinity,
	qWeek: 0.02,
	history: true
};

export const EPA_BASE: EpaParams = {
	k0: 0.45,
	kMin: 0.125,
	tau: 8,
	margin: 0,
	carry: 0.8,
	drift: 0.75,
	reset: 0.625,
	beta: 0.6,
	rhoNew: 0.4,
	rhoPrev: 0.5,
	clip: 4
};

export const CANDIDATES: Candidate[] = [
	{
		id: 'opr-event',
		label: 'OPR, this event only, season mean fallback',
		family: 'opr',
		base: { ...PLAIN, fallback: 'mean' },
		space: { minMatches: [1, 2, 3, 4] }
	},
	{
		id: 'opr-event-last',
		label: 'OPR, this event only, last event fallback',
		family: 'opr',
		base: { ...PLAIN, fallback: 'last', minMatches: 3 },
		space: { minMatches: [1, 2, 3, 4] }
	},
	{
		id: 'opr-ridge-mean',
		label: 'Ridge OPR toward the season mean',
		family: 'opr',
		base: {
			...MAP_BASE,
			history: false,
			lamNew: 1.6,
			lamPrevSeason: 1.6,
			beta: 0,
			rhoNew: 0.4,
			rhoPrev: 0.4,
			qWeek: 0
		},
		space: {
			lamNew: [0.4, 0.8, 1.2, 1.6, 2.4, 3.2],
			rhoNew: [0.2, 0.4, 0.6, 0.8, 1]
		},
		scoreSpace: { rhoNewScore: SCORE_SPACE.rhoNewScore },
		tie: { lamPrevSeason: 'lamNew', rhoPrev: 'rhoNew', rhoPrevScore: 'rhoNewScore' }
	},
	{
		id: 'robot-opr',
		label: 'aOPR: OPR with robot credit, partner carry and no team below zero',
		family: 'robot',
		base: OPR_PARAMS,
		space: {}
	},
	{
		id: 'opr-map',
		label: 'OPR with priors from earlier events (shipped until November 2026)',
		family: 'opr',
		base: MAP_BASE,
		space: {
			lamNew: [1.2, 1.6, 2, 2.4, 3.2],
			lamPrevSeason: [1, 1.5, 2, 2.5, 3],
			q: [0.075, 0.1, 0.15, 0.2, 0.3],
			qWeek: [0, 0.01, 0.02, 0.04],
			carry: [0.9, 0.95, 1, 1.05],
			drift: [0.1, 0.25, 0.5, 0.75],
			beta: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
			rhoNew: [0.1, 0.2, 0.3, 0.4],
			rhoPrev: [0.3, 0.4, 0.5, 0.6]
		},
		scoreSpace: {
			...SCORE_SPACE,
			scoreCommon: [0, 0.05, 0.1, 0.2, 0.3],
			scoreQ: [0, 0.02, 0.03, 0.05, 0.08]
		}
	},
	{
		id: 'epa',
		label: 'EPA, sequential updates, no reset between events',
		family: 'epa',
		base: { ...EPA_BASE, reset: 1 },
		space: {
			k0: [0.35, 0.45, 0.55, 0.7],
			kMin: [0.1, 0.15, 0.2, 0.25],
			tau: [4, 6, 8, 12],
			carry: [0.8, 0.9, 1],
			drift: [0.25, 0.5, 0.75],
			beta: [0.4, 0.5, 0.6, 0.8],
			rhoNew: [0.3, 0.4, 0.5, 0.6],
			rhoPrev: [0.4, 0.5, 0.6, 0.7],
			margin: [0, 0.05, 0.1]
		},
		scoreSpace: SCORE_SPACE
	},
	{
		id: 'epa-reset',
		label: 'EPA with a partial reset at each new event',
		family: 'epa',
		base: EPA_BASE,
		space: {
			reset: [0.25, 0.375, 0.5, 0.625, 0.75],
			k0: [0.35, 0.45, 0.55, 0.7],
			kMin: [0.05, 0.075, 0.1, 0.125, 0.15],
			tau: [4, 6, 8, 12],
			carry: [0.8, 0.9, 1],
			drift: [0.25, 0.5, 0.75],
			beta: [0.4, 0.5, 0.6, 0.8],
			rhoNew: [0.3, 0.4, 0.5, 0.6],
			rhoPrev: [0.4, 0.5, 0.6, 0.7]
		},
		scoreSpace: SCORE_SPACE
	}
];

export function resolve<T extends Params>(c: Candidate, params: T): T {
	const out: Record<string, unknown> = { ...params };
	for (const [key, source] of Object.entries(c.tie ?? {})) out[key] = out[source];
	return out as T;
}

function labComp(p: CompParams): LabComp {
	return {
		lamNew: p.lamNew,
		lamPrev: p.lamReturning,
		q: p.q,
		qWeek: p.qWeek,
		qMatch: 0,
		carry: p.carry,
		drift: p.drift,
		beta: p.beta,
		rhoNew: p.rhoNew,
		rhoPrev: p.rhoReturning,
		rhoNewScore: p.rhoNewScore,
		rhoPrevScore: p.rhoReturningScore
	};
}

export function robotModel(name: string, p: RobotParams): Model {
	const floor = { floor: p.floor, width: p.width };
	return new FinalOpr(
		name,
		{
			rest: labComp(p.rest),
			robot: labComp(p.robot),
			rVar: p.robotVar,
			hist: HISTORY.slice(1),
			het: p.het
		},
		p.imbFit,
		{ imb: p.imbPred, ...floor, floorScore: true },
		floor
	);
}

export function build(c: Candidate, params: Params): Model {
	const p = resolve(c, params);
	if (c.family === 'robot') return robotModel(c.id, p as RobotParams);
	return c.family === 'opr' ? new KalmanOpr(c.id, p as OprParams) : new Epa(c.id, p as EpaParams);
}

export function blend(id: string, a: Model, b: Model, w: number): Model {
	return new Blend(id, a, b, w);
}
