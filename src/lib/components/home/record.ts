import { matchDay, plausibleMatch } from '#lib/components/records/records.ts';
import { matchLabel, parseMatchKey } from '#lib/format/match.ts';
import type { AllianceColor, SeasonMatch } from '#lib/types.ts';

export interface WorldRecord {
	event: string;
	key: string;
	label: string;
	day: string;
	alliance: AllianceColor;
	red: number[];
	blue: number[];
	redScore: number;
	blueScore: number;
	ties: number;
}

interface Side {
	match: SeasonMatch;
	alliance: AllianceColor;
	score: number;
	day: string;
}

function earlier(a: Side, b: Side): boolean {
	return (
		(a.day.localeCompare(b.day) ||
			a.match.eventCode.localeCompare(b.match.eventCode) ||
			a.match.key.localeCompare(b.match.key, 'en', { numeric: true }) ||
			a.alliance.localeCompare(b.alliance)) < 0
	);
}

export function worldRecord(matches: SeasonMatch[]): WorldRecord | null {
	let best: Side | null = null;
	let ties = 0;
	for (const match of matches) {
		if (match.red.teams.length === 0 || match.blue.teams.length === 0) continue;
		if (!plausibleMatch(match)) continue;
		const day = matchDay(match);
		for (const alliance of ['red', 'blue'] as const) {
			const side: Side = { match, alliance, score: match[alliance].preFoulTotal, day };
			if (!best || side.score > best.score) {
				best = side;
				ties = 0;
			} else if (side.score === best.score) {
				ties += 1;
				if (earlier(side, best)) best = side;
			}
		}
	}
	if (!best || best.score <= 0) return null;
	const { match } = best;
	const parsed = parseMatchKey(match.key);
	return {
		event: match.eventCode,
		key: match.key,
		label: parsed ? matchLabel(parsed) : match.key.toUpperCase(),
		day: best.day,
		alliance: best.alliance,
		red: match.red.teams,
		blue: match.blue.teams,
		redScore: match.red.preFoulTotal,
		blueScore: match.blue.preFoulTotal,
		ties
	};
}
