import { SvelteMap } from 'svelte/reactivity';
import type { AllianceSelection, EventPhase, Match, Ranking, Team } from '#lib/types.ts';
import type { PickStat } from '#lib/workspace/picklist.ts';
import { deriveSelection, takenLabels } from '#lib/workspace/selection.ts';

export type FeedBundle = {
	alliances: AllianceSelection[];
	teams: Team[];
	phase?: EventPhase;
	rankings?: Ranking[];
	matches?: Pick<Match, 'result'>[];
};

type Ratings = { ratings?: { team: number; opr: number }[] };

export const SETTLED_INTERVAL = 300_000;

export function feedDelay(phase: EventPhase | undefined, interval: number): number | null {
	if (phase === 'done') return null;
	return phase === 'playoffs' ? Math.max(interval, SETTLED_INTERVAL) : interval;
}

export async function fetchTeamName(
	team: number,
	fetcher: typeof fetch = fetch
): Promise<string | null> {
	const response = await fetcher(`/api/teams/${team}`).catch(() => null);
	if (!response?.ok) return null;
	const body: unknown = await response.json().catch(() => null);
	const name = (body as { team?: { name?: unknown } } | null)?.team?.name;
	return typeof name === 'string' && name.trim() ? name.trim() : null;
}

export class SelectionFeed {
	labels = $state.raw<ReadonlyMap<number, string>>(new SvelteMap());
	names = $state.raw<ReadonlyMap<number, string>>(new SvelteMap());
	stats = $state.raw<ReadonlyMap<number, PickStat>>(new SvelteMap());

	#ranks = new Map<number, number>();
	#oprs = new Map<number, number>();

	constructor(event: () => string | null, interval = 15_000, fetcher: typeof fetch = fetch) {
		$effect(() => {
			const code = event();
			this.labels = new SvelteMap();
			this.names = new SvelteMap();
			this.#ranks = new Map();
			this.#oprs = new Map();
			this.stats = new SvelteMap();
			if (!code) return;
			let stopped = false;
			let timer: ReturnType<typeof setTimeout> | undefined;
			let played = -1;

			const rate = async (bundle: FeedBundle) => {
				const count = (bundle.matches ?? []).filter((match) => match.result).length;
				if (!bundle.rankings?.length || count === played) return;
				played = count;
				const response = await fetcher(`/api/events/${code}/analysis`).catch(() => null);
				const body: Ratings | null = response?.ok ? await response.json().catch(() => null) : null;
				if (!stopped && body) this.rate(body);
			};

			const poll = async () => {
				let delay: number | null = interval;
				if (!document.hidden) {
					const response = await fetcher(`/api/events/${code}/lite`).catch(() => null);
					const body = response?.ok ? await response.json().catch(() => null) : null;
					if (!stopped && body) {
						this.apply(body as FeedBundle);
						delay = feedDelay((body as FeedBundle).phase, interval);
						await rate(body as FeedBundle);
					}
				}
				if (!stopped && delay !== null) timer = setTimeout(poll, delay);
			};

			void poll();
			return () => {
				stopped = true;
				clearTimeout(timer);
			};
		});
	}

	apply(bundle: FeedBundle) {
		this.labels = new SvelteMap(takenLabels(deriveSelection(bundle.alliances ?? [])));
		this.names = new SvelteMap((bundle.teams ?? []).map((team) => [team.number, team.name]));
		this.#ranks = new Map((bundle.rankings ?? []).map((row) => [row.team, row.rank]));
		this.#combine();
	}

	rate(body: Ratings) {
		this.#oprs = new Map((body.ratings ?? []).map((row) => [row.team, row.opr]));
		this.#combine();
	}

	#combine() {
		const teams = new Set([...this.#ranks.keys(), ...this.#oprs.keys()]);
		this.stats = new SvelteMap(
			[...teams].map((team) => [
				team,
				{ opr: this.#oprs.get(team) ?? null, rank: this.#ranks.get(team) ?? null }
			])
		);
	}

	name(team: number): Promise<string | null> {
		const known = this.names.get(team);
		return known ? Promise.resolve(known) : fetchTeamName(team);
	}
}
