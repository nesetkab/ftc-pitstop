<script lang="ts">
	import type { EventBundle, TeamSeason } from '#lib/types.ts';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import { follows, syncFollows } from './follow.svelte.ts';
	import { chooseEvent, followedRow, unavailableRow, type FollowedRow } from './follow-status.ts';

	const LIMIT = 12;

	let ready = $state(false);
	let rows = $state<Record<number, FollowedRow>>({});

	const teams = $derived(follows.teams.slice(0, LIMIT));

	async function getJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
		const response = await fetch(url, { signal });
		return response.ok ? ((await response.json()) as T) : null;
	}

	async function loadRow(team: number, signal: AbortSignal): Promise<FollowedRow> {
		try {
			const season = await getJson<TeamSeason>(`/api/teams/${team}`, signal);
			if (!season) return unavailableRow(team);
			const chosen = chooseEvent(season, Date.now());
			const bundle =
				chosen?.standing === 'now'
					? await getJson<EventBundle>(`/api/events/${chosen.entry.event.code}`, signal).catch(
							() => null
						)
					: null;
			return followedRow(season, chosen, bundle);
		} catch {
			return unavailableRow(team);
		}
	}

	$effect(() => {
		const stop = syncFollows();
		ready = true;
		return stop;
	});

	$effect(() => {
		const controller = new AbortController();
		for (const team of teams) {
			loadRow(team, controller.signal).then((row) => {
				if (!controller.signal.aborted) rows[team] = row;
			});
		}
		return () => controller.abort();
	});
</script>

{#if ready}
	<section aria-labelledby="your-teams">
		<h2 class="sec-title" id="your-teams">Your teams</h2>
		{#if teams.length === 0}
			<p class="muted hint">Follow a team from its page and it will show up here.</p>
		{:else}
			<Table>
				<thead>
					<tr>
						<th class="l" scope="col">Team</th>
						<th class="l" scope="col">Event</th>
						<th class="l" scope="col">Next match</th>
						<th class="l" scope="col">Rank</th>
					</tr>
				</thead>
				<tbody>
					{#each teams as team (team)}
						{@const row = rows[team]}
						<tr>
							<td class="team">
								<TeamCell number={team} name={row?.name} href="/teams/{team}" />
							</td>
							{#if row}
								<td class="l">
									{#if row.eventCode}
										<a href="/events/{row.eventCode}">{row.event}</a>
										<span class="faint">{row.when}</span>
									{:else}
										{row.event}
									{/if}
								</td>
								<td class="l">{row.next}</td>
								<td class="l">{row.rank}</td>
							{:else}
								<td class="l faint" colspan="3">Loading</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</Table>
			{#if follows.teams.length > LIMIT}
				<p class="note">Showing {LIMIT} of {follows.teams.length} followed teams.</p>
			{/if}
		{/if}
	</section>
{/if}

<style>
	section {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
	}

	.hint {
		font-size: 14px;
	}

	.faint {
		margin-left: 6px;
	}
</style>
