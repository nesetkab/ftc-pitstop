import { EVENT_TYPE_NAMES, FTC_EVENT_TYPE_CODES } from '#lib/game/event-types.ts';
import { httpUrl } from '#lib/format/url.ts';
import { isValidTimeZone, zonedTimeToUtc } from '#lib/format/calendar.ts';
import type {
	Advancement,
	AdvancementStatus,
	AllianceColor,
	AllianceScore,
	AllianceSelection,
	Award,
	Event,
	EventSummary,
	FlowerElement,
	Match,
	MatchResult,
	MatchTeam,
	Ranking,
	Team,
	TournamentLevel
} from '#lib/types.ts';
import type {
	FtcAdvancementResponse,
	FtcAllianceScore,
	FtcAlliancesResponse,
	FtcAwardsResponse,
	FtcEvent,
	FtcMatchScore,
	FtcRankingsResponse,
	FtcScheduleMatch,
	FtcScheduleResponse,
	FtcScoresResponse,
	FtcTeam,
	FtcTeamsResponse
} from './schemas.ts';

function clean(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

export function mapEvent(raw: FtcEvent): Event {
	const type = FTC_EVENT_TYPE_CODES[raw.type ?? ''] ?? 'Other';
	return {
		code: raw.code.toUpperCase(),
		name: raw.name.trim(),
		type,
		typeName: clean(raw.typeName) ?? EVENT_TYPE_NAMES[type],
		region: clean(raw.regionCode),
		league: clean(raw.leagueCode),
		division: clean(raw.divisionCode),
		venue: clean(raw.venue),
		address: clean(raw.address),
		city: clean(raw.city),
		state: clean(raw.stateprov),
		country: clean(raw.country),
		timezone: isValidTimeZone(raw.timezone) ? raw.timezone : 'UTC',
		start: raw.dateStart.slice(0, 10),
		end: raw.dateEnd.slice(0, 10),
		liveStreamUrl: httpUrl(raw.liveStreamUrl),
		webcasts: (raw.webcasts ?? []).flatMap((url) => httpUrl(url) ?? []),
		website: httpUrl(raw.website),
		fieldCount: raw.fieldCount ?? 1,
		published: raw.published ?? false,
		remote: raw.remote ?? false,
		hybrid: raw.hybrid ?? false
	};
}

export function summarizeEvent(event: Event, hasMatches: boolean | null = null): EventSummary {
	return {
		code: event.code,
		name: event.name,
		type: event.type,
		typeName: event.typeName,
		region: event.region,
		league: event.league,
		venue: event.venue,
		city: event.city,
		state: event.state,
		country: event.country,
		timezone: event.timezone,
		start: event.start,
		end: event.end,
		hasMatches
	};
}

export function schoolFromFullName(fullName: string | null): string | null {
	if (!fullName?.includes('&')) return null;
	return clean(fullName.slice(fullName.lastIndexOf('&') + 1));
}

export function mapTeam(raw: FtcTeam): Team {
	const fullName = clean(raw.nameFull);
	return {
		number: raw.teamNumber,
		name: clean(raw.nameShort) ?? fullName ?? `Team ${raw.teamNumber}`,
		fullName,
		school: clean(raw.schoolName) ?? schoolFromFullName(fullName),
		city: clean(raw.city),
		state: clean(raw.stateProv),
		country: clean(raw.country),
		rookieYear: raw.rookieYear ?? null
	};
}

export function mapTeams(pages: FtcTeamsResponse[]): Team[] {
	const teams = new Map<number, Team>();
	for (const page of pages) for (const raw of page.teams) teams.set(raw.teamNumber, mapTeam(raw));
	return [...teams.values()].sort((a, b) => a.number - b.number);
}

export function mapRankings(raw: FtcRankingsResponse): Ranking[] {
	return raw.rankings
		.map((ranking) => ({
			rank: ranking.rank,
			team: ranking.teamNumber,
			rs: ranking.sortOrder1 ?? 0,
			tbp: ranking.sortOrder2 ?? 0,
			avgTips: ranking.sortOrder3 ?? 0,
			avgAuto: ranking.sortOrder4 ?? 0,
			wins: ranking.wins ?? 0,
			losses: ranking.losses ?? 0,
			ties: ranking.ties ?? 0,
			played: ranking.matchesPlayed ?? 0,
			dq: ranking.dq ?? 0,
			name: clean(ranking.teamName) ?? undefined
		}))
		.sort((a, b) => a.rank - b.rank);
}

export function mapAlliances(raw: FtcAlliancesResponse): AllianceSelection[] {
	return raw.alliances
		.filter((alliance) => alliance.captain)
		.map((alliance) => ({
			seed: alliance.number,
			name: clean(alliance.name) ?? `Alliance ${alliance.number}`,
			captain: alliance.captain!.teamNumber,
			picks: [alliance.round1, alliance.round2, alliance.round3]
				.filter((team) => team && team.teamNumber > 0)
				.map((team) => team!.teamNumber),
			backup: alliance.backup && alliance.backup.teamNumber > 0 ? alliance.backup.teamNumber : null,
			backupReplaced: alliance.backupReplaced ?? null
		}))
		.sort((a, b) => a.seed - b.seed);
}

export function mapAwards(raw: FtcAwardsResponse): Award[] {
	return raw.awards.map((award) => ({
		id: award.awardId,
		name: clean(award.name) ?? 'Award',
		placement: award.series ?? 1,
		team: award.teamNumber ?? null,
		person: clean(award.person)
	}));
}

const ADVANCEMENT_STATUS: Record<string, AdvancementStatus> = {
	FIRST: 'first',
	ALREADY_ADVANCING: 'already-advancing',
	ADVANCING_ABOVE: 'advancing-above',
	INELIGIBLE: 'ineligible'
};

export function mapAdvancement(raw: FtcAdvancementResponse): Advancement {
	return {
		advancesTo: clean(raw.advancesTo),
		advancesToName: null,
		slots: raw.slots ?? 0,
		fcmpReserved: raw.fcmpReserved ?? 0,
		teams: (raw.advancement ?? [])
			.map((slot) => ({
				slot: slot.slot,
				team: slot.team ?? null,
				criteria: clean(slot.criteria),
				declined: slot.declined ?? false,
				status: ADVANCEMENT_STATUS[slot.status ?? ''] ?? null
			}))
			.sort((a, b) => a.slot - b.slot)
	};
}

const FLOWER_ELEMENTS: Record<string, FlowerElement> = {
	RED_NECTAR: 'red',
	BLUE_NECTAR: 'blue',
	POLLEN: 'pollen'
};

function mapFlower(raw: string[] | null | undefined): FlowerElement[] {
	return (raw ?? []).flatMap((element) => FLOWER_ELEMENTS[element] ?? []);
}

export function mapAllianceScore(raw: FtcAllianceScore, opponent: FtcAllianceScore): AllianceScore {
	return {
		total: raw.totalPoints,
		preFoulTotal: raw.preFoulTotal,
		auto: raw.autoPoints,
		teleop: raw.teleopPoints,
		foulPoints: opponent.foulPointsCommitted,
		breakdown: {
			auto: {
				leave: [raw.autoRobot1Leave, raw.autoRobot2Leave],
				park: [raw.autoRobot1Park, raw.autoRobot2Park],
				tips: raw.autoHiveTips
			},
			teleop: {
				tips: raw.teleopHiveTips,
				cellBalls: raw.teleopHivePollenNectar,
				flowers: {
					red: mapFlower(raw.redAllianceFlower),
					blue: mapFlower(raw.blueAllianceFlower),
					scoring: mapFlower(raw.scoringFlower),
					audience: mapFlower(raw.audienceFlower)
				},
				gardenBalls: raw.teleopGardenPollenNectar,
				park: [raw.teleopRobot1Park, raw.teleopRobot2Park]
			},
			points: {
				autoLeave: raw.autoLeavePoints,
				autoPark: raw.autoParkPoints,
				autoHive: raw.autoHivePoints,
				auto: raw.autoPoints,
				teleopHive: raw.teleopHivePoints,
				teleopFlower: raw.teleopFlowerPoints,
				teleopGarden: raw.teleopGardenPoints,
				teleopPark: raw.teleopParkPoints,
				teleop: raw.teleopPoints
			},
			minorFouls: raw.minorFouls,
			majorFouls: raw.majorFouls,
			foulPointsCommitted: raw.foulPointsCommitted,
			rp: {
				swarm: raw.swarmRP,
				pollinator1: raw.pollinator1RP,
				pollinator2: raw.pollinator2RP
			}
		}
	};
}

export function mapLevel(raw: string | null | undefined): TournamentLevel {
	return raw?.toUpperCase().startsWith('QUAL') ? 'qual' : 'playoff';
}

function scheduleTotals(match: FtcScheduleMatch, color: AllianceColor): AllianceScore | null {
	const total = color === 'red' ? match.scoreRedFinal : match.scoreBlueFinal;
	const auto = color === 'red' ? match.scoreRedAuto : match.scoreBlueAuto;
	const foulPoints = (color === 'red' ? match.scoreBlueFoul : match.scoreRedFoul) ?? 0;
	if (total == null) return null;
	const preFoulTotal = total - foulPoints;
	return {
		total,
		preFoulTotal,
		auto: auto ?? 0,
		teleop: preFoulTotal - (auto ?? 0),
		foulPoints,
		breakdown: null
	};
}

function winnerOf(
	match: FtcScheduleMatch,
	red: AllianceScore,
	blue: AllianceScore
): AllianceColor | null {
	if (match.redWins) return 'red';
	if (match.blueWins) return 'blue';
	if (match.redWins === false && match.blueWins === false) return null;
	if (red.total === blue.total) return null;
	return red.total > blue.total ? 'red' : 'blue';
}

function mapResult(match: FtcScheduleMatch, detail: FtcMatchScore | undefined): MatchResult | null {
	const redDetail = detail?.alliances.find((alliance) => alliance.alliance.toLowerCase() === 'red');
	const blueDetail = detail?.alliances.find(
		(alliance) => alliance.alliance.toLowerCase() === 'blue'
	);
	const detailed = redDetail && blueDetail;
	const red = detailed ? mapAllianceScore(redDetail, blueDetail) : scheduleTotals(match, 'red');
	const blue = detailed ? mapAllianceScore(blueDetail, redDetail) : scheduleTotals(match, 'blue');
	if (!red || !blue) return null;
	return { red, blue, winner: winnerOf(match, red, blue) };
}

function mapMatchTeams(match: FtcScheduleMatch, color: AllianceColor): MatchTeam[] {
	return (match.teams ?? [])
		.filter((team) => team.teamNumber && team.station?.toLowerCase().startsWith(color))
		.map((team) => ({
			team: team.teamNumber!,
			station: Number(team.station!.replace(/\D/g, '')) || 1,
			surrogate: team.surrogate ?? false,
			noShow: team.noShow ?? false,
			dq: team.dq ?? false,
			onField: team.onField ?? true
		}))
		.sort((a, b) => a.station - b.station);
}

const FINALS_ONLY = /^finals?\s+\d+$/i;

export function matchKey(
	level: TournamentLevel,
	series: number,
	number: number,
	description: string
): { key: string; label: string } {
	if (level === 'qual') return { key: `q${number}`, label: `Q${number}` };
	if (FINALS_ONLY.test(description.trim())) return { key: `p${number}`, label: `F${number}` };
	const suffix = number > 1 ? `-${number}` : '';
	return { key: `p${series}${suffix}`, label: `M${series}${suffix}` };
}

function toEpoch(value: string | null | undefined, timeZone: string): number | null {
	return value ? zonedTimeToUtc(value, timeZone) : null;
}

export interface MatchSources {
	timezone: string;
	qualSchedule?: FtcScheduleResponse | null;
	playoffSchedule?: FtcScheduleResponse | null;
	qualScores?: FtcScoresResponse | null;
	playoffScores?: FtcScoresResponse | null;
}

function scoreIndex(scores: FtcScoresResponse | null | undefined): Map<string, FtcMatchScore> {
	const index = new Map<string, FtcMatchScore>();
	for (const score of scores?.matchScores ?? []) {
		index.set(`${score.matchSeries}:${score.matchNumber}`, score);
	}
	return index;
}

export function mapMatch(raw: FtcScheduleMatch, timezone: string, detail?: FtcMatchScore): Match {
	const level = mapLevel(raw.tournamentLevel);
	const description = clean(raw.description) ?? '';
	const { key, label } = matchKey(level, raw.series, raw.matchNumber, description);
	return {
		key,
		level,
		series: raw.series,
		number: raw.matchNumber,
		label,
		description: description.replace(/\s+/g, ' '),
		scheduledTime: toEpoch(raw.startTime, timezone),
		actualTime: toEpoch(raw.actualStartTime, timezone),
		postedTime: toEpoch(raw.postResultTime, timezone),
		red: mapMatchTeams(raw, 'red'),
		blue: mapMatchTeams(raw, 'blue'),
		result: mapResult(raw, detail)
	};
}

export function mapMatches(sources: MatchSources): Match[] {
	const matches: Match[] = [];
	const groups = [
		[sources.qualSchedule, scoreIndex(sources.qualScores)],
		[sources.playoffSchedule, scoreIndex(sources.playoffScores)]
	] as const;
	for (const [schedule, scores] of groups) {
		for (const raw of schedule?.schedule ?? []) {
			matches.push(mapMatch(raw, sources.timezone, scores.get(`${raw.series}:${raw.matchNumber}`)));
		}
	}
	const unique = new Map(matches.map((match) => [match.key, match]));
	return [...unique.values()].sort(compareMatches);
}

export function compareMatches(a: Match, b: Match): number {
	if (a.level !== b.level) return a.level === 'qual' ? -1 : 1;
	return a.series - b.series || a.number - b.number;
}
