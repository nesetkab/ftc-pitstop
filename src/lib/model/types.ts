export type Level = 'qual' | 'playoff';

export type AllianceDetail = {
	autoPoints?: number;
	teleopPoints?: number;
	hivePoints?: number;
	tips?: number;
	leavePoints?: number;
	parkPoints?: number;
	gardenPoints?: number;
	flowerPoints?: number;
	fouls?: number;
	robotSwarm?: number[];
};

export type ModelMatch = {
	key: string;
	eventCode: string;
	level: Level;
	series?: number;
	number?: number;
	time: number;
	scheduledTime?: number | null;
	actualTime?: number | null;
	red: number[];
	blue: number[];
	redScore: number | null;
	blueScore: number | null;
	redNp: number | null;
	blueNp: number | null;
	redDetail?: AllianceDetail;
	blueDetail?: AllianceDetail;
	surrogates?: number[];
	noShows?: number[];
	dqs?: number[];
};

export type ModelEvent = {
	code: string;
	start: string;
	end?: string;
	official?: boolean;
	matches: ModelMatch[];
};

export type Alliance = 'red' | 'blue';

export function isPlayed(m: ModelMatch): boolean {
	return m.redNp !== null && m.blueNp !== null;
}
