<script lang="ts">
	import { getEventView } from '#lib/components/event/context.ts';
	import { fixed, integer } from '#lib/format/number.ts';
	import { ordinal } from '#lib/format/ordinal.ts';
	import TeamsTable from '#lib/components/event/TeamsTable.svelte';
	import Term from '#lib/ui/Term.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const bundle = $derived(data.bundle);
	const ratings = $derived(
		data.analysis && data.analysis.ratings.length > 0 ? data.analysis.ratings : null
	);
</script>

{#if bundle.teams.length === 0}
	<p class="muted">No teams have registered yet.</p>
{:else}
	{#if data.strength}
		<div class="strength">
			<dl>
				<div>
					<dt><Term label="Strength" /></dt>
					<dd>{fixed(data.strength.top)}</dd>
				</div>
				<div>
					<dt>Strength rank</dt>
					<dd>{ordinal(data.strength.rank)} <small>of {integer(data.strength.total)}</small></dd>
				</div>
			</dl>
			<a href="/events/strength">All events by strength</a>
		</div>
	{/if}
	<TeamsTable
		teams={bundle.teams}
		rankings={bundle.rankings}
		{ratings}
		season={data.season}
		seasonCount={data.seasonCount}
		followed={view.followed}
		eventCode={bundle.event.code}
	/>
	<p class="note">
		<a href="/events/{bundle.event.code}/scouting">Print scouting reports for every team</a>
	</p>
{/if}

<style>
	.strength {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 8px 28px;
	}

	dl {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 28px;
		margin: 0;
	}

	dl div {
		display: grid;
		gap: 2px;
	}

	dt {
		font-size: 12.5px;
		color: var(--text-3);
	}

	dd {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	small {
		font-size: 13px;
		font-weight: 400;
		color: var(--text-2);
	}

	.strength > a {
		font-size: 13px;
		padding-bottom: 3px;
	}
</style>
