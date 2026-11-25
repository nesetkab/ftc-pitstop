<script lang="ts">
	import EventSections from '#lib/components/event/EventSections.svelte';
	import { REGION_BUCKETS } from '#lib/components/event/event-list.ts';
	import type { RegionSummary } from '#lib/components/region/regions.ts';
	import { fixed, integer } from '#lib/format/number.ts';
	import { SEASON_NAME, siteTitle } from '#lib/seo.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import Term from '#lib/ui/Term.svelte';
	import type { PageProps } from './$types';

	type Order = 'name' | 'teams' | 'opr';

	const ORDERS: { value: Order; label: string }[] = [
		{ value: 'name', label: 'Name' },
		{ value: 'teams', label: 'Teams' },
		{ value: 'opr', label: 'Top aOPR' }
	];

	let { data }: PageProps = $props();

	let order = $state<Order>('name');

	const sorters: Record<Order, (a: RegionSummary, b: RegionSummary) => number> = {
		name: (a, b) => a.name.localeCompare(b.name),
		teams: (a, b) => b.teams - a.teams || a.name.localeCompare(b.name),
		opr: (a, b) =>
			(b.top?.opr ?? -Infinity) - (a.top?.opr ?? -Infinity) || a.name.localeCompare(b.name)
	};

	const groups = $derived(
		REGION_BUCKETS.map(({ bucket, label }) => ({
			bucket,
			label,
			regions: listed.filter((region) => region.bucket === bucket).sort(sorters[order])
		})).filter((group) => group.regions.length > 0)
	);
	const listed = $derived(data.regions.filter((region) => region.events > 0));
	const events = $derived(data.regions.reduce((sum, region) => sum + region.events, 0));
	const done = $derived(data.regions.reduce((sum, region) => sum + region.done, 0));
</script>

<Seo
	title={siteTitle(`FTC regions, ${SEASON_NAME}`)}
	description="Every FTC region in the {SEASON_NAME} season with its team count, events played and still to come, and its top team by aOPR."
	path="/regions"
/>

<EventSections />

<PageHeader
	title="Regions"
	meta="{integer(listed.length)} regions this season, {integer(done)} of {integer(
		events
	)} events played."
>
	{#snippet status()}
		{#if data.updated}
			<StaleNotice updated={data.updated} staleAfter={86400} prefix="Ratings updated" />
		{/if}
	{/snippet}
</PageHeader>

{#if listed.length === 0}
	<EmptyState title="No regions yet.">The event list is still loading. Try again soon.</EmptyState>
{:else}
	<div class="controls">
		<Segmented
			label="Sort regions"
			options={ORDERS}
			value={order}
			onselect={(next) => (order = next)}
		/>
	</div>

	{#each groups as group (group.bucket)}
		<section aria-labelledby="{group.bucket}-title">
			<h2 class="sec-title" id="{group.bucket}-title">{group.label}</h2>
			<div class="table-wrap">
				<table class="t regions">
					<caption class="visually-hidden">Regions in {group.label}</caption>
					<thead>
						<tr>
							<th class="l region" scope="col">Region</th>
							<th class="opt count" scope="col">Teams</th>
							<th class="count" scope="col">Played</th>
							<th class="opt left" scope="col">Left</th>
							<th class="l" scope="col">Top team</th>
							<th class="score" scope="col"><Term label="aOPR" /></th>
						</tr>
					</thead>
					<tbody>
						{#each group.regions as region (region.code)}
							<tr>
								<td class="l name">
									<a href="/regions/{region.code}">{region.name}</a>
									<span class="sub">
										{region.teams > 0
											? `${integer(region.teams)} ${region.teams === 1 ? 'team' : 'teams'}`
											: 'No team list yet'}{region.live > 0
											? ` · ${integer(region.live)} today`
											: ''}
									</span>
								</td>
								<td class="opt">{region.teams > 0 ? integer(region.teams) : '—'}</td>
								<td class="played">
									{integer(region.done)} <span class="faint">of {integer(region.events)}</span>
								</td>
								<td class="opt">
									{integer(region.live + region.upcoming)}
									{#if region.live > 0}
										<span class="live">{integer(region.live)} today</span>
									{/if}
								</td>
								<td class="team">
									{#if region.top}
										<TeamCell
											number={region.top.team}
											name={region.top.name}
											href="/teams/{region.top.team}"
										/>
									{:else}
										<span class="faint">Not rated yet</span>
									{/if}
								</td>
								<td class="opr">{region.top ? fixed(region.top.opr) : ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/each}
{/if}

<p class="note">
	Teams counts every team registered for an event in the region, including visitors. Played and left
	count competitions only. A team belongs to the region where it has played the most matches.
</p>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}

	section {
		display: grid;
		gap: 10px;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.regions td {
		padding-block: 8px;
	}

	.regions {
		table-layout: fixed;
	}

	.regions th.region {
		width: 28%;
	}

	.regions th.count {
		width: 11%;
	}

	.regions th.left {
		width: 13%;
	}

	.regions th.score {
		width: 9%;
	}

	.regions td.team {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.name {
		white-space: normal;
	}

	.name a {
		font-weight: 500;
	}

	.sub {
		display: none;
		font-size: 13px;
		color: var(--text-2);
	}

	.live {
		margin-left: 6px;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--text);
	}

	.opr {
		font-weight: 600;
	}

	@media (max-width: 600px) {
		.regions th.region {
			width: 34%;
		}

		.regions th.count {
			width: 22%;
		}

		.regions th.score {
			width: 16%;
		}

		.sub {
			display: block;
		}

		td.team :global(.name) {
			display: none;
		}
	}
</style>
