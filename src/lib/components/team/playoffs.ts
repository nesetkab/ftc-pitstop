import { parseMatchDescription } from '#lib/format/index.ts';
import type { AllianceSelection, EventBundle, Match, MatchTeam } from '#lib/types.ts';

type Bundle = Pick<EventBundle, 'alliances' | 'matches' | 'phase'>;

interface Game {
	match: Match;
	mine: number;
	theirs: number;
	won: boolean | null;
}

function members(alliance: AllianceSelection): number[] {
	return [alliance.captain, ...alliance.picks, alliance.backup].filter(
		(team): team is number => typeof team === 'number' && team > 0
	);
}

function role(alliance: AllianceSelection, team: number): string {
	if (alliance.captain === team) return `Captain of alliance ${alliance.seed}`;
	const pick = alliance.picks.indexOf(team);
	if (pick === 0) return `First pick of alliance ${alliance.seed}`;
	if (pick === 1) return `Second pick of alliance ${alliance.seed}`;
	if (pick > 1) return `Pick ${pick + 1} of alliance ${alliance.seed}`;
	return `Backup for alliance ${alliance.seed}`;
}

function seedIndex(alliances: AllianceSelection[]): Map<number, number> {
	const index = new Map<number, number>();
	for (const alliance of alliances) {
		for (const team of members(alliance)) index.set(team, alliance.seed);
	}
	return index;
}

function sideSeed(side: MatchTeam[], index: Map<number, number>): number | null {
	for (const entry of side) {
		const seed = index.get(entry.team);
		if (seed !== undefined) return seed;
	}
	return null;
}

function gamesFor(bundle: Bundle, seed: number): Game[] {
	const index = seedIndex(bundle.alliances);
	const games: Game[] = [];
	for (const match of bundle.matches) {
		if (match.level !== 'playoff' || !match.result) continue;
		const side =
			sideSeed(match.red, index) === seed
				? 'red'
				: sideSeed(match.blue, index) === seed
					? 'blue'
					: null;
		if (!side) continue;
		const other = side === 'red' ? 'blue' : 'red';
		games.push({
			match,
			mine: match.result[side].total,
			theirs: match.result[other].total,
			won: match.result.winner === null ? null : match.result.winner === side
		});
	}
	return games;
}

function isFinal(match: Match): boolean {
	return /^finals?\b/i.test(match.description);
}

function eliminationSpot(match: Match): string {
	const parsed = parseMatchDescription(match.description);
	if (parsed?.level === 'playoff' && parsed.bracket && parsed.bracket !== 'final' && parsed.round) {
		return `${parsed.bracket} bracket round ${parsed.round}`;
	}
	return `match ${match.label}`;
}

function outcome(games: Game[], done: boolean): string | null {
	if (games.length === 0) return null;
	const finals = games.filter((game) => isFinal(game.match));
	if (finals.length === 1) {
		const [game] = finals;
		const verb = game.won === null ? 'tied' : game.won ? 'won' : 'lost';
		return `${verb} the final ${game.mine}–${game.theirs}`;
	}
	if (finals.length > 1) {
		const wins = finals.filter((game) => game.won === true).length;
		const losses = finals.filter((game) => game.won === false).length;
		if (!done || wins === losses) return `in the finals, ${wins}–${losses}`;
		const verb = wins > losses ? 'won' : 'lost';
		return `${verb} the finals ${Math.max(wins, losses)}–${Math.min(wins, losses)}`;
	}
	const lost = games.filter((game) => game.won === false);
	const last = games[games.length - 1];
	if (lost.length >= 2) return `eliminated in ${eliminationSpot(lost[1].match)}`;
	if (done && last.won === false) return `eliminated in ${eliminationSpot(last.match)}`;
	return done ? null : 'still playing';
}

export function playoffSummary(bundle: Bundle, team: number): string | null {
	if (bundle.alliances.length === 0) return null;
	const alliance = bundle.alliances.find((entry) => members(entry).includes(team));
	const started = bundle.phase === 'playoffs' || bundle.phase === 'done';
	if (!alliance) return started ? 'Not on an alliance' : null;
	const label = role(alliance, team);
	if (!started) return label;
	const result = outcome(gamesFor(bundle, alliance.seed), bundle.phase === 'done');
	return result ? `${label}, ${result}` : label;
}
