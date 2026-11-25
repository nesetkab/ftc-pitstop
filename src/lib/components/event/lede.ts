import type { EventBundle } from '#lib/types.ts';
import { buildBracket } from './bracket.ts';

export type Lede = { lead: string; rest?: string };

type LedeSource = Pick<EventBundle, 'alliances' | 'matches'>;

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

export function eventLede(bundle: LedeSource): Lede | null {
	return champion(bundle);
}
