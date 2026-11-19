import type { Sums, TeamState } from '#lib/model/opr.ts';
import type { SwarmState } from '#lib/model/rp.ts';

export type Alliance = 'red' | 'blue';

export type RatingParts = {
	auto: number;
	hive: number;
	flower: number;
	garden: number;
	park: number;
	tips: number;
};

export type TeamRating = {
	team: number;
	opr: number;
	parts: RatingParts;
	matches: number;
	rank: number;
	prior: number;
	history: { key: string; time: number; opr: number }[];
};

export type RpChances = {
	win: number;
	tie: number;
	swarm: number;
	pollinator1: number;
	pollinator2: number;
	expected: number;
};

export type AllianceForecast = {
	score: number;
	sd: number;
	win: number;
	rp: RpChances;
};

export type MatchForecast = {
	key: string;
	red: AllianceForecast;
	blue: AllianceForecast;
	tie: number;
	played: boolean;
	correct: boolean | null;
};

export type MatchTiming = {
	key: string;
	scheduled: number | null;
	expectedStart: number | null;
	queueAt: number | null;
	matchesAway: number | null;
};

export type EventTiming = {
	cycleSeconds: number | null;
	delaySeconds: number | null;
	onField: string | null;
	next: string | null;
	matches: Record<string, MatchTiming>;
};

export type Projection = {
	team: number;
	rankChances: number[];
	top4: number;
	top8: number;
	expectedRs: number;
	expectedRank: number;
};

export type ScheduleStrength = {
	team: number;
	partners: number;
	opponents: number;
	ratingRank: number;
	expectedRs: number;
	actualRs: number;
};

export type AllianceOdds = {
	seed: number;
	teams: number[];
	strength: number;
	winEvent: number;
	reachFinal: number;
	winNext: number;
};

export type PickOption = {
	team: number;
	opr: number;
	auto: number;
	tips: number;
	park: number;
	winRound1: number;
	reachUpperFinal: number;
	winEvent: number;
	promotesCaptain: number | null;
};

export type PickAnalysis = {
	seed: number;
	captain: number;
	options: PickOption[];
};

export type EventAnalysis = {
	code: string;
	generatedAt: number;
	model: { id: string; label: string };
	ratings: TeamRating[];
	forecasts: Record<string, MatchForecast>;
	timing: EventTiming;
	projections: Projection[] | null;
	strength: ScheduleStrength[];
	playoffs: AllianceOdds[] | null;
	picks: PickAnalysis | null;
	averages: { parts: RatingParts; score: number; matches: number };
};

export type SeasonRating = {
	team: number;
	opr: number;
	parts: RatingParts;
	matches: number;
	events: number;
	rank: number;
	percentile: number;
	region: string | null;
};

export type SeasonRatings = {
	generatedAt: number;
	teams: SeasonRating[];
};

export type AnalysisContext = {
	teams: number[];
	states: Record<number, TeamState>;
	previous: Record<number, number>;
	sums: Sums;
	swarm: SwarmState;
};

export type RatingPoint = { event: string; key: string; time: number; opr: number };

export type TeamEventRating = {
	code: string;
	start: string;
	prior: number;
	opr: number;
	matches: number;
};

export type TeamRatingHistory = {
	team: number;
	generatedAt: number;
	events: TeamEventRating[];
	points: RatingPoint[];
};
