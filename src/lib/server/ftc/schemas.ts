import * as z from 'zod';

const text = z.string().nullish();
const count = z.number().nullish();
const flag = z.boolean().nullish();

export const ftcEvent = z.object({
	code: z.string(),
	divisionCode: text,
	name: z.string(),
	remote: flag,
	hybrid: flag,
	fieldCount: count,
	published: flag,
	type: text,
	typeName: text,
	regionCode: text,
	leagueCode: text,
	districtCode: text,
	venue: text,
	address: text,
	city: text,
	stateprov: text,
	country: text,
	website: text,
	liveStreamUrl: text,
	webcasts: z.array(z.string()).nullish(),
	timezone: text,
	dateStart: z.string(),
	dateEnd: z.string()
});

export const ftcEventsResponse = z.object({
	events: z.array(ftcEvent),
	eventCount: count
});

export const ftcTeam = z.object({
	teamNumber: z.number(),
	nameFull: text,
	nameShort: text,
	schoolName: text,
	city: text,
	stateProv: text,
	country: text,
	website: text,
	rookieYear: count,
	homeRegion: text,
	displayLocation: text
});

export const ftcTeamsResponse = z.object({
	teams: z.array(ftcTeam),
	teamCountTotal: count,
	teamCountPage: count,
	pageCurrent: count,
	pageTotal: count
});

export const ftcRanking = z.object({
	rank: z.number(),
	teamNumber: z.number(),
	teamName: text,
	sortOrder1: count,
	sortOrder2: count,
	sortOrder3: count,
	sortOrder4: count,
	sortOrder5: count,
	sortOrder6: count,
	wins: count,
	losses: count,
	ties: count,
	qualAverage: count,
	dq: count,
	matchesPlayed: count,
	matchesCounted: count
});

export const ftcRankingsResponse = z.object({
	rankings: z.array(ftcRanking)
});

export const ftcScheduleTeam = z.object({
	teamNumber: count,
	station: text,
	surrogate: flag,
	noShow: flag,
	dq: flag,
	onField: flag,
	teamName: text
});

export const ftcScheduleMatch = z.object({
	description: text,
	tournamentLevel: text,
	series: z.number(),
	matchNumber: z.number(),
	startTime: text,
	actualStartTime: text,
	postResultTime: text,
	scoreRedFinal: count,
	scoreRedFoul: count,
	scoreRedAuto: count,
	scoreBlueFinal: count,
	scoreBlueFoul: count,
	scoreBlueAuto: count,
	redWins: flag,
	blueWins: flag,
	teams: z.array(ftcScheduleTeam).nullish()
});

export const ftcScheduleResponse = z.object({
	schedule: z.array(ftcScheduleMatch)
});

export const ftcMatchResultTeam = z.object({
	teamNumber: z.number(),
	station: text,
	dq: flag,
	onField: flag
});

export const ftcMatchResult = z.object({
	actualStartTime: text,
	description: text,
	tournamentLevel: text,
	series: z.number(),
	matchNumber: z.number(),
	scoreRedFinal: count,
	scoreRedFoul: count,
	scoreRedAuto: count,
	scoreBlueFinal: count,
	scoreBlueFoul: count,
	scoreBlueAuto: count,
	postResultTime: text,
	teams: z.array(ftcMatchResultTeam).nullish(),
	modifiedOn: text
});

export const ftcMatchesResponse = z.object({
	matches: z.array(ftcMatchResult)
});

const flower = z.array(z.string()).nullish();

export const ftcAllianceScore = z.object({
	alliance: z.string(),
	team: count,
	autoHiveTips: z.number(),
	autoRobot1Leave: z.boolean(),
	autoRobot2Leave: z.boolean(),
	autoRobot1Park: z.boolean(),
	autoRobot2Park: z.boolean(),
	autoLeavePoints: z.number(),
	autoParkPoints: z.number(),
	autoHivePoints: z.number(),
	teleopHiveTips: z.number(),
	teleopHivePollenNectar: z.number(),
	redAllianceFlower: flower,
	scoringFlower: flower,
	blueAllianceFlower: flower,
	audienceFlower: flower,
	teleopGardenPollenNectar: z.number(),
	teleopRobot1Park: z.boolean(),
	teleopRobot2Park: z.boolean(),
	teleopHivePoints: z.number(),
	teleopFlowerPoints: z.number(),
	teleopGardenPoints: z.number(),
	teleopParkPoints: z.number(),
	autoPoints: z.number(),
	teleopPoints: z.number(),
	foulPointsCommitted: z.number(),
	preFoulTotal: z.number(),
	swarmRP: z.boolean(),
	pollinator1RP: z.boolean(),
	pollinator2RP: z.boolean(),
	totalPoints: z.number(),
	majorFouls: z.number(),
	minorFouls: z.number()
});

export const ftcMatchScore = z.object({
	matchLevel: text,
	matchSeries: z.number(),
	matchNumber: z.number(),
	randomization: count,
	alliances: z.array(ftcAllianceScore)
});

export const ftcScoresResponse = z.object({
	matchScores: z.array(ftcMatchScore)
});

const ftcAllianceTeam = z
	.object({
		teamNumber: z.number(),
		teamName: text
	})
	.nullish();

export const ftcAlliance = z.object({
	number: z.number(),
	name: text,
	captain: ftcAllianceTeam,
	round1: ftcAllianceTeam,
	round2: ftcAllianceTeam,
	round3: ftcAllianceTeam,
	backup: ftcAllianceTeam,
	backupReplaced: count
});

export const ftcAlliancesResponse = z.object({
	alliances: z.array(ftcAlliance),
	count: count
});

export const ftcAward = z.object({
	awardId: z.number(),
	eventCode: text,
	name: text,
	series: count,
	teamNumber: count,
	schoolName: text,
	fullTeamName: text,
	person: text
});

export const ftcAwardsResponse = z.object({
	awards: z.array(ftcAward)
});

export const ftcAdvancementSlot = z.object({
	team: count,
	displayTeam: text,
	slot: z.number(),
	criteria: text,
	declined: flag,
	status: text
});

export const ftcAdvancementResponse = z.object({
	advancesTo: text,
	slots: count,
	fcmpReserved: count,
	advancement: z.array(ftcAdvancementSlot).nullish()
});

export type FtcEvent = z.output<typeof ftcEvent>;
export type FtcEventsResponse = z.output<typeof ftcEventsResponse>;
export type FtcTeam = z.output<typeof ftcTeam>;
export type FtcTeamsResponse = z.output<typeof ftcTeamsResponse>;
export type FtcRankingsResponse = z.output<typeof ftcRankingsResponse>;
export type FtcScheduleMatch = z.output<typeof ftcScheduleMatch>;
export type FtcScheduleResponse = z.output<typeof ftcScheduleResponse>;
export type FtcMatchesResponse = z.output<typeof ftcMatchesResponse>;
export type FtcAllianceScore = z.output<typeof ftcAllianceScore>;
export type FtcMatchScore = z.output<typeof ftcMatchScore>;
export type FtcScoresResponse = z.output<typeof ftcScoresResponse>;
export type FtcAlliancesResponse = z.output<typeof ftcAlliancesResponse>;
export type FtcAwardsResponse = z.output<typeof ftcAwardsResponse>;
export type FtcAdvancementResponse = z.output<typeof ftcAdvancementResponse>;
