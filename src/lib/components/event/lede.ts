import { record } from '#lib/format/record.ts';
import type { EventBundle } from '#lib/types.ts';
import { buildBracket } from './bracket.ts';

export type Lede = { lead: string; rest?: string };

type LedeSource = Pick<EventBundle, 'alliances' | 'matches' | 'rankings' | 'teams' | 'phase'>;

function list(items: string[]): string {
	if (items.length < 2) return items.join('');
	return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function champion(bundle: LedeSource): Lede | null {
	if (bundle.alliances.length === 0) return null;
	const seed = buildBracket(bundle.alliances, bundle.matches)?.champion ?? null;
	const alliance = bundle.alliances.find((entry) => entry.seed === seed);
	if (!alliance) return null;
	const teams = [alliance.captain, ...alliance.picks].map(String);
	return { lead: `${list(teams)} won the event`, rest: `as alliance ${alliance.seed}.` };
}

function leader(bundle: LedeSource): Lede | null {
	const top = bundle.rankings.reduce<LedeSource['rankings'][number] | null>(
		(best, row) => (best === null || row.rank < best.rank ? row : best),
		null
	);
	if (!top || top.played === 0) return null;
	const name = bundle.teams.find((team) => team.number === top.team)?.name ?? top.name;
	const who = name ? `${top.team} ${name}` : String(top.team);
	const still = bundle.phase === 'quals' || bundle.phase === 'upcoming';
	const verb = still ? 'leads the rankings' : 'finished first in qualification';
	return {
		lead: `${who} ${verb}`,
		rest: `with a ${record(top.wins, top.losses, top.ties)} record.`
	};
}

export function eventLede(bundle: LedeSource): Lede | null {
	return champion(bundle) ?? leader(bundle);
}
