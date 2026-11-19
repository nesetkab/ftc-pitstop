export type AllianceColor = 'red' | 'blue';

export type TournamentLevel = 'qual' | 'playoff';

export type FlowerElement = 'red' | 'blue' | 'pollen';

export type EventPhase = 'upcoming' | 'quals' | 'selection' | 'playoffs' | 'done';

export type DataSource = 'ftc' | 'ftcscout';

export type EventType =
	| 'NonAdvancement'
	| 'Scrimmage'
	| 'LeagueMeet'
	| 'Qualifier'
	| 'LeagueTournament'
	| 'Championship'
	| 'Other'
	| 'FIRSTChampionship'
	| 'SuperQualifier'
	| 'InnovationChallenge'
	| 'OffSeason'
	| 'Kickoff'
	| 'Workshop'
	| 'DemoExhibition'
	| 'VolunteerSignup'
	| 'PracticeDay'
	| 'Premier'
	| 'Pilot';

export interface Event {
	code: string;
	name: string;
	type: EventType;
	typeName: string;
	region: string | null;
	league: string | null;
	division: string | null;
	venue: string | null;
	address: string | null;
	city: string | null;
	state: string | null;
	country: string | null;
	timezone: string;
	start: string;
	end: string;
	liveStreamUrl: string | null;
	webcasts: string[];
	website: string | null;
	fieldCount: number;
	published: boolean;
	remote: boolean;
	hybrid: boolean;
}

export interface EventSummary {
	code: string;
	name: string;
	type: EventType;
	typeName: string;
	region: string | null;
	league: string | null;
	venue: string | null;
	city: string | null;
	state: string | null;
	country: string | null;
	timezone: string;
	start: string;
	end: string;
	hasMatches: boolean | null;
}

export interface Team {
	number: number;
	name: string;
	fullName: string | null;
	school: string | null;
	city: string | null;
	state: string | null;
	country: string | null;
	rookieYear: number | null;
}

export interface MatchTeam {
	team: number;
	station: number;
	surrogate: boolean;
	noShow: boolean;
	dq: boolean;
	onField: boolean;
}

export type RobotPair = [boolean, boolean];

export interface Flowers {
	red: FlowerElement[];
	blue: FlowerElement[];
	scoring: FlowerElement[];
	audience: FlowerElement[];
}

export interface ScorePoints {
	autoLeave: number;
	autoPark: number;
	autoHive: number;
	auto: number;
	teleopHive: number;
	teleopFlower: number;
	teleopGarden: number;
	teleopPark: number;
	teleop: number;
}

export interface ScoreBreakdown {
	auto: {
		leave: RobotPair;
		park: RobotPair;
		tips: number;
	};
	teleop: {
		tips: number;
		cellBalls: number;
		flowers: Flowers;
		gardenBalls: number;
		park: RobotPair;
	};
	points: ScorePoints;
	minorFouls: number;
	majorFouls: number;
	foulPointsCommitted: number;
	rp: {
		swarm: boolean;
		pollinator1: boolean;
		pollinator2: boolean;
	};
}

export interface AllianceScore {
	total: number;
	preFoulTotal: number;
	auto: number;
	teleop: number;
	foulPoints: number;
	breakdown: ScoreBreakdown | null;
}

export interface MatchResult {
	red: AllianceScore;
	blue: AllianceScore;
	winner: AllianceColor | null;
}

export interface Match {
	key: string;
	level: TournamentLevel;
	series: number;
	number: number;
	label: string;
	description: string;
	scheduledTime: number | null;
	actualTime: number | null;
	postedTime: number | null;
	red: MatchTeam[];
	blue: MatchTeam[];
	result: MatchResult | null;
}

export interface Ranking {
	rank: number;
	team: number;
	rs: number;
	tbp: number;
	avgTips: number;
	avgAuto: number;
	wins: number;
	losses: number;
	ties: number;
	played: number;
	dq: number;
}

export interface AllianceSelection {
	seed: number;
	name: string;
	captain: number;
	picks: number[];
	backup: number | null;
	backupReplaced: number | null;
}

export interface Award {
	id: number;
	name: string;
	placement: number;
	team: number | null;
	person: string | null;
}

export type AdvancementStatus =
	'first' | 'already-advancing' | 'advancing-above' | 'ineligible' | null;

export interface AdvancementSlot {
	slot: number;
	team: number | null;
	criteria: string | null;
	declined: boolean;
	status: AdvancementStatus;
}

export interface Advancement {
	advancesTo: string | null;
	slots: number;
	fcmpReserved: number;
	teams: AdvancementSlot[];
}

export interface EventBundle {
	event: Event;
	teams: Team[];
	matches: Match[];
	rankings: Ranking[];
	alliances: AllianceSelection[];
	awards: Award[];
	advancement: Advancement | null;
	phase: EventPhase;
	fetchedAt: number;
	stale: boolean;
	source: DataSource;
}

export interface QuickStat {
	value: number;
	rank: number;
}

export interface QuickStats {
	season: number;
	total: QuickStat;
	auto: QuickStat;
	teleop: QuickStat;
	endgame: QuickStat;
	count: number;
}

export interface TeamEventStats {
	rank: number;
	rs: number;
	tbp: number;
	avgTips: number;
	wins: number;
	losses: number;
	ties: number;
	dq: number;
	played: number;
	opr: {
		total: number;
		auto: number;
		teleop: number;
	};
}

export interface TeamSeasonEvent {
	event: EventSummary;
	stats: TeamEventStats | null;
	awards: Award[];
}

export interface TeamSeason {
	team: Team;
	events: TeamSeasonEvent[];
	quickStats: QuickStats | null;
	previousQuickStats: QuickStats | null;
	fetchedAt: number;
	stale: boolean;
}

export interface SeasonMatchAlliance {
	teams: number[];
	surrogates: number[];
	noShows: number[];
	dqs: number[];
	total: number;
	preFoulTotal: number;
	auto: number;
	teleop: number;
	hive: number;
	flower: number;
	garden: number;
	park: number;
	foulPoints: number;
	tips: number;
	leavePark: number;
	robots: number[];
	rp: {
		swarm: boolean;
		pollinator1: boolean;
		pollinator2: boolean;
	};
}

export interface SeasonMatch {
	eventCode: string;
	eventType: EventType;
	region: string | null;
	date: string;
	end: string;
	time: number | null;
	key: string;
	level: TournamentLevel;
	series: number;
	number: number;
	red: SeasonMatchAlliance;
	blue: SeasonMatchAlliance;
}

export interface SearchTeam {
	number: number;
	name: string;
	city: string | null;
	state: string | null;
	country: string | null;
}

export interface SearchIndex {
	teams: SearchTeam[];
	events: EventSummary[];
	fetchedAt: number;
}

export type QueueStatus = 'queuing-soon' | 'now-queuing' | 'on-deck' | 'on-field';

export interface QueueTimes {
	scheduledStart: number | null;
	estimatedQueue: number | null;
	estimatedOnDeck: number | null;
	estimatedOnField: number | null;
	estimatedStart: number | null;
	actualQueue: number | null;
	actualOnDeck: number | null;
	actualOnField: number | null;
	actualStart: number | null;
	actualCommit: number | null;
}

export interface QueueMatch {
	label: string;
	key: string | null;
	status: QueueStatus | null;
	red: number[];
	blue: number[];
	times: QueueTimes;
	breakAfter: string | null;
	replayOf: string | null;
}

export interface QueueAnnouncement {
	id: string;
	text: string;
	postedTime: number;
}

export interface QueueStatusSnapshot {
	eventKey: string;
	dataAsOfTime: number;
	nowQueuing: string | null;
	matches: QueueMatch[];
	announcements: QueueAnnouncement[];
}
