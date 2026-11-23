import * as z from 'zod';
import { SEASON } from '#lib/game/biobuzz.ts';
import { EVENT_TYPE_NAMES, eventTypeFromName } from '#lib/game/event-types.ts';
import { httpUrl } from '#lib/format/url.ts';
import { createBreaker, type Breaker } from '#lib/server/breaker.ts';
import { isValidTimeZone } from '#lib/format/calendar.ts';
import type {
	AllianceColor,
	AllianceScore,
	Award,
	Event,
	EventSummary,
	FlowerElement,
	Match,
	MatchTeam,
	QuickStats,
	Ranking,
	SeasonMatch,
	SeasonMatchAlliance,
	Team,
	TeamSeasonEvent,
	TournamentLevel
} from '#lib/types.ts';

export const FTCSCOUT_URL = 'https://api.ftcscout.org/graphql';
export const USER_AGENT = 'PitStop/1.0 (+https://ftcpitstop.com)';

export class FtcScoutError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'FtcScoutError';
		this.status = status;
	}
}

export interface FtcScoutClientOptions {
	fetch?: typeof fetch;
	timeoutMs?: number;
	retries?: number;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
	pauseMs?: number;
	breaker?: Breaker;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const PAUSE_MS = 60_000;
const MAX_PAUSE_DOUBLINGS = 4;
const MAX_PAUSED_QUERIES = 500;

function isTimeout(error: unknown): boolean {
	return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function isOutage(status: number): boolean {
	return status === 429 || status >= 500;
}

function mediaType(response: Response): string {
	return response.headers.get('content-type')?.split(';')[0].trim() || 'a response';
}

interface Payload {
	data?: unknown;
	errors?: unknown[];
}

export function createFtcScoutClient(options: FtcScoutClientOptions = {}) {
	const timeoutMs = options.timeoutMs ?? 5_000;
	const retries = options.retries ?? 1;
	const sleep = options.sleep ?? defaultSleep;
	const now = options.now ?? Date.now;
	const pauseMs = options.pauseMs ?? PAUSE_MS;
	const paused = new Map<string, { failures: number; until: number }>();
	const breaker = options.breaker ?? createBreaker({ now });

	function pause(body: string) {
		const failures = (paused.get(body)?.failures ?? 0) + 1;
		paused.delete(body);
		if (paused.size >= MAX_PAUSED_QUERIES) paused.delete(paused.keys().next().value!);
		const wait = pauseMs * 2 ** Math.min(failures - 1, MAX_PAUSE_DOUBLINGS);
		paused.set(body, { failures, until: now() + wait });
	}

	async function fetchPayload(body: string, wait: number): Promise<Payload> {
		for (let attempt = 0; ; attempt++) {
			let response: Response;
			try {
				response = await (options.fetch ?? fetch)(FTCSCOUT_URL, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						accept: 'application/json',
						'user-agent': USER_AGENT
					},
					body,
					signal: AbortSignal.timeout(wait)
				});
			} catch (error) {
				if (isTimeout(error)) throw new FtcScoutError(504, 'FTCScout timed out');
				if (attempt < retries) {
					await sleep(500 * 2 ** attempt);
					continue;
				}
				throw new FtcScoutError(502, 'FTCScout is unreachable');
			}
			if (response.status >= 500 && attempt < retries) {
				await response.body?.cancel();
				await sleep(500 * 2 ** attempt);
				continue;
			}
			if (!response.ok) {
				await response.body?.cancel();
				throw new FtcScoutError(response.status, `FTCScout error ${response.status}`);
			}
			let text: string;
			try {
				text = await response.text();
			} catch (error) {
				throw isTimeout(error)
					? new FtcScoutError(504, 'FTCScout timed out')
					: new FtcScoutError(502, 'FTCScout cut the response short');
			}
			let payload: unknown;
			try {
				payload = JSON.parse(text);
			} catch {
				throw new FtcScoutError(502, `FTCScout sent ${mediaType(response)} instead of JSON`);
			}
			if (!payload || typeof payload !== 'object') {
				throw new FtcScoutError(502, 'FTCScout sent an empty response');
			}
			return payload;
		}
	}

	async function send(body: string, wait: number): Promise<Payload> {
		try {
			const payload = await fetchPayload(body, wait);
			breaker.success();
			return payload;
		} catch (error) {
			if (error instanceof FtcScoutError && isOutage(error.status)) breaker.failure();
			else breaker.success();
			throw error;
		}
	}

	async function query<S extends z.ZodType>(
		operationName: string,
		document: string,
		variables: Record<string, unknown>,
		schema: S,
		init: { timeoutMs?: number } = {}
	): Promise<z.output<S>> {
		const body = JSON.stringify({ operationName, query: document, variables });
		const pausedUntil = paused.get(body)?.until ?? 0;
		if (now() < pausedUntil) throw new FtcScoutError(503, 'FTCScout is paused after errors');
		if (!breaker.allow()) throw new FtcScoutError(503, 'FTCScout is paused after errors');
		try {
			const payload = await send(body, init.timeoutMs ?? timeoutMs);
			if (payload.errors?.length && !payload.data) {
				throw new FtcScoutError(502, 'FTCScout rejected the query');
			}
			const parsed = schema.safeParse(payload.data);
			if (!parsed.success) {
				console.warn(
					`FTCScout shape changed for ${operationName}: ${z.prettifyError(parsed.error).slice(0, 500)}`
				);
				throw new FtcScoutError(502, 'FTCScout sent data in an unexpected shape');
			}
			paused.delete(body);
			return parsed.data;
		} catch (error) {
			pause(body);
			throw error;
		}
	}

	return { query, breaker };
}

export type FtcScoutClient = ReturnType<typeof createFtcScoutClient>;

const location = z.object({
	venue: z.string().nullish(),
	city: z.string().nullish(),
	state: z.string().nullish(),
	country: z.string().nullish()
});

const eventSummary = z.object({
	code: z.string(),
	name: z.string(),
	type: z.string(),
	start: z.string(),
	end: z.string(),
	timezone: z.string().nullish(),
	regionCode: z.string().nullish(),
	leagueCode: z.string().nullish(),
	hasMatches: z.boolean().nullish(),
	location: location.nullish()
});

const EVENT_SUMMARY_FIELDS =
	'code name type start end timezone regionCode leagueCode hasMatches location { venue city state country }';

const quickStat = z.object({ value: z.number(), rank: z.number() });
const quickStats = z
	.object({
		season: z.number(),
		tot: quickStat,
		auto: quickStat,
		dc: quickStat,
		eg: quickStat,
		count: z.number()
	})
	.nullish();

const QUICK_STATS_FIELDS =
	'season tot { value rank } auto { value rank } dc { value rank } eg { value rank } count';

const nectar = z.array(z.string().nullish()).nullish();

const fullAlliance = z.object({
	autoLeave1: z.number(),
	autoLeave2: z.number(),
	autoParkPoints1: z.number(),
	autoParkPoints2: z.number(),
	autoHiveTips: z.number(),
	autoLeavePoints: z.number(),
	autoParkPoints: z.number(),
	autoHivePoints: z.number(),
	dcHiveTips: z.number(),
	dcHivePollenNectar: z.number(),
	dcHivePoints: z.number(),
	redAllianceFlowerState: nectar,
	blueAllianceFlowerState: nectar,
	scoringFlowerState: nectar,
	audienceFlowerState: nectar,
	dcFlowerPoints: z.number(),
	dcGardenPollenNectar: z.number(),
	dcGardenPoints: z.number(),
	dcParkPoints1: z.number(),
	dcParkPoints2: z.number(),
	dcParkPoints: z.number(),
	autoPoints: z.number(),
	dcPoints: z.number(),
	minorsCommitted: z.number(),
	majorsCommitted: z.number(),
	penaltyPointsCommitted: z.number(),
	penaltyPointsByOpp: z.number(),
	totalPointsNp: z.number(),
	totalPoints: z.number(),
	swarmRp: z.boolean(),
	pollinator1Rp: z.boolean(),
	pollinator2Rp: z.boolean()
});

const FULL_ALLIANCE_FIELDS =
	'autoLeave1 autoLeave2 autoParkPoints1 autoParkPoints2 autoHiveTips autoLeavePoints autoParkPoints autoHivePoints dcHiveTips dcHivePollenNectar dcHivePoints redAllianceFlowerState blueAllianceFlowerState scoringFlowerState audienceFlowerState dcFlowerPoints dcGardenPollenNectar dcGardenPoints dcParkPoints1 dcParkPoints2 dcParkPoints autoPoints dcPoints minorsCommitted majorsCommitted penaltyPointsCommitted penaltyPointsByOpp totalPointsNp totalPoints swarmRp pollinator1Rp pollinator2Rp';

const summaryAlliance = z.object({
	totalPoints: z.number(),
	totalPointsNp: z.number(),
	autoPoints: z.number(),
	dcPoints: z.number(),
	penaltyPointsByOpp: z.number(),
	autoLeavePoints: z.number(),
	autoParkPoints: z.number(),
	dcParkPoints: z.number(),
	dcHivePoints: z.number(),
	dcFlowerPoints: z.number(),
	dcGardenPoints: z.number(),
	autoLeave1: z.number(),
	autoLeave2: z.number(),
	autoParkPoints1: z.number(),
	autoParkPoints2: z.number(),
	dcParkPoints1: z.number(),
	dcParkPoints2: z.number(),
	tips: z.number(),
	swarmRp: z.boolean(),
	pollinator1Rp: z.boolean(),
	pollinator2Rp: z.boolean()
});

const SUMMARY_ALLIANCE_FIELDS =
	'totalPoints totalPointsNp autoPoints dcPoints penaltyPointsByOpp autoLeavePoints autoParkPoints dcParkPoints dcHivePoints dcFlowerPoints dcGardenPoints autoLeave1 autoLeave2 autoParkPoints1 autoParkPoints2 dcParkPoints1 dcParkPoints2 tips swarmRp pollinator1Rp pollinator2Rp';

const matchTeam = z.object({
	teamNumber: z.number(),
	alliance: z.string(),
	station: z.string(),
	surrogate: z.boolean().nullish(),
	noShow: z.boolean().nullish(),
	dq: z.boolean().nullish(),
	onField: z.boolean().nullish()
});

const MATCH_TEAM_FIELDS = 'teamNumber alliance station surrogate noShow dq onField';

function scoresOf<S extends z.ZodType>(alliance: S) {
	return z.object({ red: alliance.nullish(), blue: alliance.nullish() }).nullish();
}

const awardRow = z.object({
	eventCode: z.string().nullish(),
	type: z.string(),
	placement: z.number(),
	teamNumber: z.number().nullish(),
	personName: z.string().nullish()
});

function clean(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

export function mapEventSummary(raw: z.output<typeof eventSummary>): EventSummary {
	const type = eventTypeFromName(raw.type);
	return {
		code: raw.code.toUpperCase(),
		name: raw.name.trim(),
		type,
		typeName: EVENT_TYPE_NAMES[type],
		region: clean(raw.regionCode),
		league: clean(raw.leagueCode),
		venue: clean(raw.location?.venue),
		city: clean(raw.location?.city),
		state: clean(raw.location?.state),
		country: clean(raw.location?.country),
		timezone: isValidTimeZone(raw.timezone) ? raw.timezone : 'UTC',
		start: raw.start.slice(0, 10),
		end: raw.end.slice(0, 10),
		hasMatches: raw.hasMatches ?? null
	};
}

export function mapQuickStats(raw: z.output<typeof quickStats>): QuickStats | null {
	if (!raw) return null;
	return {
		season: raw.season,
		total: raw.tot,
		auto: raw.auto,
		teleop: raw.dc,
		endgame: raw.eg,
		count: raw.count
	};
}

const AWARD_NAMES: Record<string, [number, string]> = {
	JudgesChoice: [1, "Judges' Choice Award"],
	Promote: [2, 'Promote Award'],
	Compass: [3, 'Compass Award'],
	Control: [4, 'Control Award'],
	Motivate: [5, 'Motivate Award'],
	Design: [6, 'Design Award'],
	Innovate: [7, 'Innovate Award'],
	Connect: [8, 'Connect Award'],
	Think: [9, 'Think Award'],
	Inspire: [11, 'Inspire Award'],
	Finalist: [12, 'Finalist Alliance'],
	Winner: [13, 'Winning Alliance'],
	Reach: [25, 'Reach Award'],
	Sustain: [26, 'Sustain Award'],
	DeansListFinalist: [0, "Dean's List Finalist"],
	DeansListSemiFinalist: [0, "Dean's List Semi-Finalist"],
	DeansListWinner: [0, "Dean's List Winner"],
	TopRanked: [0, 'Top Ranked Team'],
	DivisionWinner: [0, 'Division Winner'],
	DivisionFinalist: [0, 'Division Finalist'],
	ConferenceFinalist: [0, 'Conference Finalist']
};

export function mapAward(raw: z.output<typeof awardRow>): Award {
	const [id, name] = AWARD_NAMES[raw.type] ?? [0, raw.type];
	return {
		id,
		name,
		placement: raw.placement,
		team: raw.teamNumber ?? null,
		person: clean(raw.personName)
	};
}

const NECTAR: Record<string, FlowerElement> = {
	RedNectar: 'red',
	BlueNectar: 'blue',
	Pollen: 'pollen'
};

function mapFlower(raw: (string | null | undefined)[] | null | undefined): FlowerElement[] {
	return (raw ?? []).flatMap((element) => (element && NECTAR[element]) || []);
}

export function mapFullAlliance(raw: z.output<typeof fullAlliance>): AllianceScore {
	return {
		total: raw.totalPoints,
		preFoulTotal: raw.totalPointsNp,
		auto: raw.autoPoints,
		teleop: raw.dcPoints,
		foulPoints: raw.penaltyPointsByOpp,
		breakdown: {
			auto: {
				leave: [raw.autoLeave1 > 0, raw.autoLeave2 > 0],
				park: [raw.autoParkPoints1 > 0, raw.autoParkPoints2 > 0],
				tips: raw.autoHiveTips
			},
			teleop: {
				tips: raw.dcHiveTips,
				cellBalls: raw.dcHivePollenNectar,
				flowers: {
					red: mapFlower(raw.redAllianceFlowerState),
					blue: mapFlower(raw.blueAllianceFlowerState),
					scoring: mapFlower(raw.scoringFlowerState),
					audience: mapFlower(raw.audienceFlowerState)
				},
				gardenBalls: raw.dcGardenPollenNectar,
				park: [raw.dcParkPoints1 > 0, raw.dcParkPoints2 > 0]
			},
			points: {
				autoLeave: raw.autoLeavePoints,
				autoPark: raw.autoParkPoints,
				autoHive: raw.autoHivePoints,
				auto: raw.autoPoints,
				teleopHive: raw.dcHivePoints,
				teleopFlower: raw.dcFlowerPoints,
				teleopGarden: raw.dcGardenPoints,
				teleopPark: raw.dcParkPoints,
				teleop: raw.dcPoints
			},
			minorFouls: raw.minorsCommitted,
			majorFouls: raw.majorsCommitted,
			foulPointsCommitted: raw.penaltyPointsCommitted,
			rp: {
				swarm: raw.swarmRp,
				pollinator1: raw.pollinator1Rp,
				pollinator2: raw.pollinator2Rp
			}
		}
	};
}

const STATIONS: Record<string, number> = { One: 1, Two: 2, Solo: 1 };

function teamsFor(teams: z.output<typeof matchTeam>[], color: AllianceColor): MatchTeam[] {
	return teams
		.filter((team) => team.alliance.toLowerCase() === color)
		.map((team) => ({
			team: team.teamNumber,
			station: STATIONS[team.station] ?? 1,
			surrogate: team.surrogate ?? false,
			noShow: team.noShow ?? false,
			dq: team.dq ?? false,
			onField: team.onField ?? true
		}))
		.sort((a, b) => a.station - b.station);
}

export function scoutMatchKey(
	level: string,
	series: number,
	number: number
): { key: string; label: string; level: TournamentLevel } {
	if (level === 'Quals') return { key: `q${number}`, label: `Q${number}`, level: 'qual' };
	if (level === 'Finals') return { key: `p${number}`, label: `F${number}`, level: 'playoff' };
	const suffix = number > 1 ? `-${number}` : '';
	return { key: `p${series}${suffix}`, label: `M${series}${suffix}`, level: 'playoff' };
}

function epoch(value: string | null | undefined): number | null {
	if (!value) return null;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? null : parsed;
}

const eventMatch = z.object({
	id: z.number(),
	tournamentLevel: z.string(),
	series: z.number(),
	matchNum: z.number(),
	description: z.string().nullish(),
	scheduledStartTime: z.string().nullish(),
	actualStartTime: z.string().nullish(),
	postResultTime: z.string().nullish(),
	hasBeenPlayed: z.boolean(),
	teams: z.array(matchTeam),
	scores: scoresOf(fullAlliance)
});

export function mapScoutMatch(raw: z.output<typeof eventMatch>): Match {
	const { key, label, level } = scoutMatchKey(raw.tournamentLevel, raw.series, raw.matchNum);
	const red = raw.scores?.red ? mapFullAlliance(raw.scores.red) : null;
	const blue = raw.scores?.blue ? mapFullAlliance(raw.scores.blue) : null;
	return {
		key,
		level,
		series: raw.series,
		number: raw.matchNum,
		label,
		description: clean(raw.description) ?? label,
		scheduledTime: epoch(raw.scheduledStartTime),
		actualTime: epoch(raw.actualStartTime),
		postedTime: epoch(raw.postResultTime),
		red: teamsFor(raw.teams, 'red'),
		blue: teamsFor(raw.teams, 'blue'),
		result:
			raw.hasBeenPlayed && red && blue
				? {
						red,
						blue,
						winner: red.total === blue.total ? null : red.total > blue.total ? 'red' : 'blue'
					}
				: null
	};
}

const teamStats2026 = z
	.object({
		rank: z.number(),
		rp: z.number(),
		tb1: z.number(),
		tb2: z.number(),
		wins: z.number(),
		losses: z.number(),
		ties: z.number(),
		dqs: z.number(),
		qualMatchesPlayed: z.number(),
		avg: z.object({ autoPoints: z.number() }).nullish(),
		opr: z
			.object({ totalPointsNp: z.number(), autoPoints: z.number(), dcPoints: z.number() })
			.nullish()
	})
	.nullish();

const scoutTeam = z.object({
	number: z.number(),
	name: z.string(),
	schoolName: z.string().nullish(),
	rookieYear: z.number().nullish(),
	location: location.nullish()
});

export function mapScoutTeam(raw: z.output<typeof scoutTeam>): Team {
	return {
		number: raw.number,
		name: clean(raw.name) ?? `Team ${raw.number}`,
		fullName: null,
		school: clean(raw.schoolName),
		city: clean(raw.location?.city),
		state: clean(raw.location?.state),
		country: clean(raw.location?.country),
		rookieYear: raw.rookieYear ?? null
	};
}

const eventByCode = z.object({
	eventByCode: z
		.object({
			code: z.string(),
			name: z.string(),
			type: z.string(),
			start: z.string(),
			end: z.string(),
			timezone: z.string().nullish(),
			remote: z.boolean().nullish(),
			hybrid: z.boolean().nullish(),
			fieldCount: z.number().nullish(),
			published: z.boolean().nullish(),
			regionCode: z.string().nullish(),
			leagueCode: z.string().nullish(),
			divisionCode: z.string().nullish(),
			address: z.string().nullish(),
			website: z.string().nullish(),
			liveStreamURL: z.string().nullish(),
			webcasts: z.array(z.string()).nullish(),
			location: location.nullish(),
			teams: z.array(z.object({ teamNumber: z.number(), team: scoutTeam, stats: teamStats2026 })),
			matches: z.array(eventMatch),
			awards: z.array(awardRow)
		})
		.nullish()
});

const EVENT_BY_CODE = `query EventByCode($season: Int!, $code: String!) {
	eventByCode(season: $season, code: $code) {
		code name type start end timezone remote hybrid fieldCount published regionCode leagueCode divisionCode address website liveStreamURL webcasts
		location { venue city state country }
		teams {
			teamNumber
			team { number name schoolName rookieYear location { city state country } }
			stats { ... on TeamEventStats2026 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed avg { autoPoints } } }
		}
		matches {
			id tournamentLevel series matchNum description scheduledStartTime actualStartTime postResultTime hasBeenPlayed
			teams { ${MATCH_TEAM_FIELDS} }
			scores { ... on MatchScores2026 { red { ${FULL_ALLIANCE_FIELDS} } blue { ${FULL_ALLIANCE_FIELDS} } } }
		}
		awards { type placement teamNumber personName }
	}
}`;

export interface ScoutEventData {
	event: Event;
	teams: Team[];
	matches: Match[];
	rankings: Ranking[];
	awards: Award[];
}

export function mapEventByCode(data: z.output<typeof eventByCode>): ScoutEventData | null {
	const raw = data.eventByCode;
	if (!raw) return null;
	const type = eventTypeFromName(raw.type);
	const event: Event = {
		code: raw.code.toUpperCase(),
		name: raw.name.trim(),
		type,
		typeName: EVENT_TYPE_NAMES[type],
		region: clean(raw.regionCode),
		league: clean(raw.leagueCode),
		division: clean(raw.divisionCode),
		venue: clean(raw.location?.venue),
		address: clean(raw.address),
		city: clean(raw.location?.city),
		state: clean(raw.location?.state),
		country: clean(raw.location?.country),
		timezone: isValidTimeZone(raw.timezone) ? raw.timezone : 'UTC',
		start: raw.start.slice(0, 10),
		end: raw.end.slice(0, 10),
		liveStreamUrl: httpUrl(raw.liveStreamURL),
		webcasts: (raw.webcasts ?? []).flatMap((url) => httpUrl(url) ?? []),
		website: httpUrl(raw.website),
		fieldCount: raw.fieldCount ?? 1,
		published: raw.published ?? true,
		remote: raw.remote ?? false,
		hybrid: raw.hybrid ?? false
	};
	const rankings: Ranking[] = raw.teams
		.flatMap((entry) =>
			entry.stats && entry.stats.rank > 0
				? [
						{
							rank: entry.stats.rank,
							team: entry.teamNumber,
							rs: entry.stats.rp,
							tbp: entry.stats.tb1,
							avgTips: entry.stats.tb2,
							avgAuto: entry.stats.avg?.autoPoints ?? 0,
							wins: entry.stats.wins,
							losses: entry.stats.losses,
							ties: entry.stats.ties,
							played: entry.stats.qualMatchesPlayed,
							dq: entry.stats.dqs
						}
					]
				: []
		)
		.sort((a, b) => a.rank - b.rank);
	return {
		event,
		teams: raw.teams.map((entry) => mapScoutTeam(entry.team)).sort((a, b) => a.number - b.number),
		matches: raw.matches.map(mapScoutMatch),
		rankings,
		awards: raw.awards.map(mapAward)
	};
}

const seasonEvents = z.object({ eventsSearch: z.array(eventSummary) });
const eventsOnDate = z.object({ eventsOnDate: z.array(eventSummary) });

const teamSeason = z.object({
	teamByNumber: scoutTeam
		.extend({
			quickStats,
			previous: quickStats,
			awards: z.array(awardRow),
			events: z.array(
				z.object({
					eventCode: z.string(),
					stats: teamStats2026,
					event: eventSummary
				})
			)
		})
		.nullish()
});

const seasonMatchesSchema = z.object({
	eventsSearch: z.array(
		z.object({
			code: z.string(),
			type: z.string(),
			start: z.string(),
			end: z.string(),
			regionCode: z.string().nullish(),
			remote: z.boolean().nullish(),
			matches: z.array(
				z.object({
					tournamentLevel: z.string(),
					series: z.number(),
					matchNum: z.number(),
					hasBeenPlayed: z.boolean(),
					actualStartTime: z.string().nullish(),
					teams: z.array(matchTeam),
					scores: scoresOf(summaryAlliance)
				})
			)
		})
	)
});

export interface ScoutTeamSeason {
	team: Team;
	events: TeamSeasonEvent[];
	quickStats: QuickStats | null;
	previousQuickStats: QuickStats | null;
}

export function mapTeamSeason(data: z.output<typeof teamSeason>): ScoutTeamSeason | null {
	const raw = data.teamByNumber;
	if (!raw) return null;
	const awards = raw.awards.map((award) => ({
		code: award.eventCode?.toUpperCase(),
		award: mapAward(award)
	}));
	return {
		team: mapScoutTeam(raw),
		events: raw.events
			.map((entry) => ({
				event: mapEventSummary(entry.event),
				stats: entry.stats
					? {
							rank: entry.stats.rank,
							rs: entry.stats.rp,
							tbp: entry.stats.tb1,
							avgTips: entry.stats.tb2,
							wins: entry.stats.wins,
							losses: entry.stats.losses,
							ties: entry.stats.ties,
							dq: entry.stats.dqs,
							played: entry.stats.qualMatchesPlayed,
							opr: {
								total: entry.stats.opr?.totalPointsNp ?? 0,
								auto: entry.stats.opr?.autoPoints ?? 0,
								teleop: entry.stats.opr?.dcPoints ?? 0
							}
						}
					: null,
				awards: awards
					.filter((award) => award.code === entry.eventCode.toUpperCase())
					.map((award) => award.award)
			}))
			.sort((a, b) => a.event.start.localeCompare(b.event.start)),
		quickStats: mapQuickStats(raw.quickStats),
		previousQuickStats: mapQuickStats(raw.previous)
	};
}

const SEATS: Record<string, 1 | 2> = { One: 1, Two: 2 };

function seasonAlliance(
	teams: z.output<typeof matchTeam>[],
	color: AllianceColor,
	score: z.output<typeof summaryAlliance>
): SeasonMatchAlliance {
	const mine = teams.filter((team) => team.alliance.toLowerCase() === color);
	const seated = mine
		.filter((team) => SEATS[team.station])
		.sort((a, b) => SEATS[a.station] - SEATS[b.station]);
	const playing = seated.length
		? seated
		: mine.filter((team) => team.onField !== false && team.station !== 'NotOnField').slice(0, 2);
	const numbers = (flag: (team: z.output<typeof matchTeam>) => boolean | null | undefined) =>
		playing.filter(flag).map((team) => team.teamNumber);
	const robot = (seat: 1 | 2) =>
		seat === 1
			? score.autoLeave1 + score.autoParkPoints1 + score.dcParkPoints1
			: score.autoLeave2 + score.autoParkPoints2 + score.dcParkPoints2;
	return {
		teams: playing.map((team) => team.teamNumber),
		surrogates: numbers((team) => team.surrogate),
		noShows: numbers((team) => team.noShow),
		dqs: numbers((team) => team.dq),
		total: score.totalPoints,
		preFoulTotal: score.totalPointsNp,
		auto: score.autoPoints,
		teleop: score.dcPoints,
		hive: score.dcHivePoints,
		flower: score.dcFlowerPoints,
		garden: score.dcGardenPoints,
		park: score.dcParkPoints,
		foulPoints: score.penaltyPointsByOpp,
		tips: score.tips,
		leavePark: score.autoLeavePoints + score.autoParkPoints + score.dcParkPoints,
		robots: playing.map((team) => robot(SEATS[team.station] ?? 1)),
		rp: { swarm: score.swarmRp, pollinator1: score.pollinator1Rp, pollinator2: score.pollinator2Rp }
	};
}

export function mapSeasonMatches(data: z.output<typeof seasonMatchesSchema>): SeasonMatch[] {
	const matches: SeasonMatch[] = [];
	for (const event of data.eventsSearch) {
		if (event.remote) continue;
		for (const match of event.matches) {
			const red = match.scores?.red;
			const blue = match.scores?.blue;
			if (!match.hasBeenPlayed || !red || !blue) continue;
			const { key, level } = scoutMatchKey(match.tournamentLevel, match.series, match.matchNum);
			matches.push({
				eventCode: event.code.toUpperCase(),
				eventType: eventTypeFromName(event.type),
				region: clean(event.regionCode),
				date: event.start.slice(0, 10),
				end: event.end.slice(0, 10),
				time: epoch(match.actualStartTime),
				key,
				level,
				series: match.series,
				number: match.matchNum,
				red: seasonAlliance(match.teams, 'red', red),
				blue: seasonAlliance(match.teams, 'blue', blue)
			});
		}
	}
	return matches;
}

export const scoutClient = createFtcScoutClient();

export async function fetchSeasonEvents(
	season = SEASON,
	scout: FtcScoutClient = scoutClient
): Promise<EventSummary[]> {
	const data = await scout.query(
		'EventsSearch',
		`query EventsSearch($season: Int!) { eventsSearch(season: $season) { ${EVENT_SUMMARY_FIELDS} } }`,
		{ season },
		seasonEvents,
		{ timeoutMs: 6_000 }
	);
	return data.eventsSearch.map(mapEventSummary).sort(compareEvents);
}

export async function fetchEventsOnDate(
	date: string,
	scout: FtcScoutClient = scoutClient
): Promise<EventSummary[]> {
	const data = await scout.query(
		'EventsOnDate',
		`query EventsOnDate($date: DateTime) { eventsOnDate(date: $date) { ${EVENT_SUMMARY_FIELDS} } }`,
		{ date: `${date.slice(0, 10)}T12:00:00.000Z` },
		eventsOnDate
	);
	return data.eventsOnDate.map(mapEventSummary).sort(compareEvents);
}

export async function fetchEventByCode(
	code: string,
	season = SEASON,
	scout: FtcScoutClient = scoutClient
): Promise<ScoutEventData | null> {
	const data = await scout.query('EventByCode', EVENT_BY_CODE, { season, code }, eventByCode, {
		timeoutMs: 6_000
	});
	return mapEventByCode(data);
}

export async function fetchTeamSeason(
	number: number,
	season = SEASON,
	scout: FtcScoutClient = scoutClient
): Promise<ScoutTeamSeason | null> {
	const document = `query TeamSeason($number: Int!, $season: Int!, $previous: Int!) {
		teamByNumber(number: $number) {
			number name schoolName rookieYear location { city state country }
			quickStats(season: $season) { ${QUICK_STATS_FIELDS} }
			previous: quickStats(season: $previous) { ${QUICK_STATS_FIELDS} }
			awards(season: $season) { eventCode type placement teamNumber personName }
			events(season: $season) {
				eventCode
				stats { ... on TeamEventStats2026 { rank rp tb1 tb2 wins losses ties dqs qualMatchesPlayed opr { totalPointsNp autoPoints dcPoints } } }
				event { ${EVENT_SUMMARY_FIELDS} }
			}
		}
	}`;
	const data = await scout.query(
		'TeamSeason',
		document,
		{ number, season, previous: season - 1 },
		teamSeason
	);
	return mapTeamSeason(data);
}

export async function fetchQuickStats(
	numbers: number[],
	season = SEASON - 1,
	scout: FtcScoutClient = scoutClient
): Promise<Map<number, QuickStats>> {
	const result = new Map<number, QuickStats>();
	const unique = [...new Set(numbers.filter((number) => Number.isInteger(number) && number > 0))];
	for (let i = 0; i < unique.length; i += 50) {
		const chunk = unique.slice(i, i + 50);
		const fields = chunk
			.map(
				(number) =>
					`t${number}: teamByNumber(number: ${number}) { number quickStats(season: $season) { ${QUICK_STATS_FIELDS} } }`
			)
			.join('\n');
		const schema = z.record(z.string(), z.object({ number: z.number(), quickStats }).nullish());
		const data = await scout.query(
			'QuickStats',
			`query QuickStats($season: Int!) {\n${fields}\n}`,
			{ season },
			schema
		);
		for (const entry of Object.values(data)) {
			const stats = entry ? mapQuickStats(entry.quickStats) : null;
			if (entry && stats) result.set(entry.number, stats);
		}
	}
	return result;
}

export async function fetchSeasonMatches(
	options: { season?: number; start: string; end: string },
	scout: FtcScoutClient = scoutClient
): Promise<SeasonMatch[]> {
	const document = `query EventsSearch($season: Int!, $start: Date, $end: Date) {
		eventsSearch(season: $season, hasMatches: true, start: $start, end: $end) {
			code type start end regionCode remote
			matches {
				tournamentLevel series matchNum hasBeenPlayed actualStartTime
				teams { ${MATCH_TEAM_FIELDS} }
				scores { ... on MatchScores2026 { red { ${SUMMARY_ALLIANCE_FIELDS} } blue { ${SUMMARY_ALLIANCE_FIELDS} } } }
			}
		}
	}`;
	const data = await scout.query(
		'EventsSearch',
		document,
		{ season: options.season ?? SEASON, start: options.start, end: options.end },
		seasonMatchesSchema,
		{ timeoutMs: 20_000 }
	);
	return mapSeasonMatches(data);
}

export function compareEvents(a: EventSummary, b: EventSummary): number {
	return a.start.localeCompare(b.start) || a.name.localeCompare(b.name);
}
