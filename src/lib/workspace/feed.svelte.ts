import type { AllianceSelection, Team } from '#lib/types.ts';
import { deriveSelection, takenLabels } from '#lib/workspace/selection.ts';

export type FeedBundle = { alliances: AllianceSelection[]; teams: Team[] };

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
	labels = $state.raw<ReadonlyMap<number, string>>(new Map());
	names = $state.raw<ReadonlyMap<number, string>>(new Map());

	constructor(event: () => string | null, interval = 15_000, fetcher: typeof fetch = fetch) {
		$effect(() => {
			const code = event();
			this.labels = new Map();
			this.names = new Map();
			if (!code) return;
			let stopped = false;
			let timer: ReturnType<typeof setTimeout> | undefined;

			const poll = async () => {
				if (!document.hidden) {
					const response = await fetcher(`/api/events/${code}`).catch(() => null);
					const body: unknown = response?.ok ? await response.json().catch(() => null) : null;
					if (!stopped && body) this.apply(body as FeedBundle);
				}
				if (!stopped) timer = setTimeout(poll, interval);
			};

			void poll();
			return () => {
				stopped = true;
				clearTimeout(timer);
			};
		});
	}

	apply(bundle: FeedBundle) {
		this.labels = takenLabels(deriveSelection(bundle.alliances ?? []));
		this.names = new Map((bundle.teams ?? []).map((team) => [team.number, team.name]));
	}

	name(team: number): Promise<string | null> {
		const known = this.names.get(team);
		return known ? Promise.resolve(known) : fetchTeamName(team);
	}
}
