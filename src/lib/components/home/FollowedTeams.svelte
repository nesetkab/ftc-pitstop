<script lang="ts">
	import { compareHref, MAX_COMPARE } from '#lib/components/compare/compare.ts';
	import { follows, syncFollows } from '#lib/components/follow/follow.svelte.ts';
	import { fixed, ordinal, shortDate } from '#lib/format/index.ts';
	import type { EventBundle } from '#lib/types.ts';
	import {
		liveStatus,
		MAX_FOLLOWED,
		teamListQuery,
		type FollowedTeam,
		type LiveBundle
	} from './followed.ts';
	import TeamFinder from './TeamFinder.svelte';

	const REFRESH_MS = 60_000;
	const STANDING_ORDER = { today: 0, next: 1, last: 2, none: 3 } as const;

	let ready = $state(false);
	let failed = $state(false);
	let info = $state<Record<number, FollowedTeam>>({});
	let bundles = $state<Record<string, LiveBundle | null>>({});
	let now = $state(Date.now());

	const teams = $derived(follows.teams.slice(0, MAX_FOLLOWED));
	const ordered = $derived(
		[...teams].sort((a, b) => STANDING_ORDER[standingOf(a)] - STANDING_ORDER[standingOf(b)])
	);
	const query = $derived(teamListQuery(teams));
	const liveCodes = $derived(
		[
			...new Set(
				teams.flatMap((team) => {
					const event = info[team]?.event;
					return event?.reason === 'today' ? [event.code] : [];
				})
			)
		].sort()
	);
	const liveKey = $derived(liveCodes.join(','));

	async function getJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
		const response = await fetch(url, { signal });
		return response.ok ? ((await response.json()) as T) : null;
	}

	$effect(() => {
		const stop = syncFollows();
		ready = true;
		return stop;
	});

	$effect(() => {
		if (!query) return;
		const controller = new AbortController();
		failed = false;
		getJson<{ teams: FollowedTeam[] }>(`/api/following?teams=${query}`, controller.signal)
			.then((body) => {
				if (!body) {
					failed = true;
					return;
				}
				info = Object.fromEntries(body.teams.map((team) => [team.number, team]));
			})
			.catch(() => {
				if (!controller.signal.aborted) failed = true;
			});
		return () => controller.abort();
	});

	$effect(() => {
		const codes = liveKey ? liveKey.split(',') : [];
		if (codes.length === 0) return;
		const controller = new AbortController();
		const refresh = () => {
			if (document.visibilityState === 'hidden') return;
			now = Date.now();
			for (const code of codes) {
				getJson<EventBundle>(`/api/events/${code}/lite`, controller.signal)
					.then((bundle) => {
						if (bundle || !(code in bundles)) bundles[code] = bundle;
					})
					.catch(() => {
						if (!controller.signal.aborted && !(code in bundles)) bundles[code] = null;
					});
			}
		};
		refresh();
		const timer = setInterval(refresh, REFRESH_MS);
		return () => {
			clearInterval(timer);
			controller.abort();
		};
	});

	function standingOf(team: number): keyof typeof STANDING_ORDER {
		return info[team]?.event?.reason ?? 'none';
	}

	function count(value: number): string {
		return value.toLocaleString('en-US');
	}

	function place(rank: number): string {
		return count(rank) + ordinal(rank).slice(String(rank).length);
	}

	function score(own: number, other: number): string {
		return `${own}–${other}`;
	}
</script>

<section aria-labelledby="your-teams">
	<div class="head">
		<h2 class="sec-title" id="your-teams">Your teams</h2>
		{#if ready && teams.length >= 2}
			<a class="more" href={compareHref(teams.slice(0, MAX_COMPARE))}>
				Compare {teams.length > MAX_COMPARE ? `the first ${MAX_COMPARE}` : 'these teams'}
			</a>
		{/if}
	</div>
	{#if !ready || teams.length === 0}
		<div class={{ pending: !ready }}>
			<TeamFinder />
		</div>
	{:else}
		<ul class="teams">
			{#each ordered as team (team)}
				{@const row = info[team]}
				{@const event = row?.event}
				{@const bundle = event?.reason === 'today' ? bundles[event.code] : undefined}
				{@const status = bundle ? liveStatus(bundle, team, now) : null}
				<li>
					<div class="head">
						<a class="team" href="/teams/{team}">
							<b>{team}</b>
							{#if row?.name}<span class="name">{row.name}</span>{/if}
						</a>
						<a class="pit-link" href="/{team}">Pit screen</a>
					</div>
					{#if !row}
						<p class="line faint">{failed ? 'Could not load this team' : 'Loading'}</p>
					{:else if !row.found}
						<p class="line faint">Team not found</p>
					{:else if event?.reason === 'today'}
						<p class="line">
							<span class="faint">At</span>
							<a href="/events/{event.code}">{event.name}</a>
						</p>
						<dl class="facts">
							<div>
								<dt>Rank</dt>
								<dd>
									{#if status?.rank}
										{ordinal(status.rank)}
										<span class="faint">of {status.teams} · {status.record}</span>
									{:else if !status && row.standing}
										{ordinal(row.standing.rank)}
									{:else}
										<span class="faint">Not ranked yet</span>
									{/if}
								</dd>
							</div>
							<div>
								<dt>Next</dt>
								<dd>
									{#if status?.next}
										<a href="/events/{event.code}/matches/{status.next.key}">{status.next.label}</a>
										<span class={['side', status.next.side]}>{status.next.side}</span>
										{#if status.next.when}
											<span class="faint"
												>{status.next.estimated ? 'about ' : ''}{status.next.when}</span
											>
										{/if}
									{:else if status}
										<span class="faint">{status.note}</span>
									{:else}
										<span class="faint">{bundle === null ? 'Unavailable' : 'Loading'}</span>
									{/if}
								</dd>
							</div>
							<div>
								<dt>Last</dt>
								<dd>
									{#if status?.last}
										<a href="/events/{event.code}/matches/{status.last.key}">{status.last.label}</a>
										<span class={['outcome', status.last.outcome]}>{status.last.outcome}</span>
										<span class="num">{score(status.last.own, status.last.other)}</span>
									{:else}
										<span class="faint">No matches played</span>
									{/if}
								</dd>
							</div>
						</dl>
					{:else}
						<p class="line">
							{#if event}
								<span class="faint">{event.reason === 'next' ? 'Next' : 'Last'}</span>
								<a href="/events/{event.code}">{event.name}</a>
								<span class="faint">
									{event.reason === 'next'
										? shortDate(event.start)
										: `ended ${shortDate(event.end)}`}
								</span>
							{:else}
								<span class="faint">No events this season</span>
							{/if}
						</p>
						{#if row.opr !== null}
							<p class="line">
								<span class="faint">OPR</span>
								<span class="num">{fixed(row.opr)}</span>
								{#if row.worldRank}
									<span class="faint">
										· {place(row.worldRank)}{row.rated ? ` of ${count(row.rated)}` : ''} worldwide
									</span>
								{/if}
							</p>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
		{#if follows.teams.length > MAX_FOLLOWED}
			<p class="note">Showing {MAX_FOLLOWED} of {follows.teams.length} followed teams.</p>
		{/if}
	{/if}
</section>

<style>
	section {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 16px;
	}

	.more {
		font-size: 14px;
		color: var(--text-2);
	}

	.more:hover {
		color: var(--text);
	}

	:global(:root[data-following]) .pending {
		visibility: hidden;
	}

	.teams {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
		gap: 16px 32px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		gap: 4px;
		align-content: start;
		padding: 1px 0 1px 12px;
		border-left: 2px solid var(--accent);
		font-size: 14px;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		min-width: 0;
	}

	.team {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 15px;
		text-decoration: none;
	}

	.team:hover .name {
		text-decoration: underline;
	}

	.team b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.name {
		margin-left: 6px;
		color: var(--text-2);
	}

	.pit-link {
		flex: none;
		font-size: 13px;
		color: var(--text-2);
	}

	.line {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.line a,
	.facts a {
		text-decoration: none;
	}

	.line a:hover,
	.facts a:hover {
		text-decoration: underline;
	}

	.facts {
		display: grid;
		gap: 2px;
		margin: 0;
	}

	.facts div {
		display: flex;
		gap: 10px;
		min-width: 0;
	}

	dt {
		flex: none;
		width: 3.2em;
		color: var(--text-3);
	}

	dd {
		min-width: 0;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.num,
	dd {
		font-variant-numeric: tabular-nums;
	}

	.side {
		font-size: 12.5px;
		font-weight: 600;
	}

	.side.red {
		color: var(--red);
	}

	.side.blue {
		color: var(--blue);
	}

	.outcome {
		display: inline-block;
		min-width: 1.1em;
		font-weight: 600;
		text-align: center;
	}

	.outcome.L,
	.outcome.T {
		color: var(--text-3);
	}

	@media (pointer: coarse) {
		.pit-link,
		.more {
			display: inline-block;
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
