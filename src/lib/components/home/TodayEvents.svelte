<script lang="ts">
	import type { TodayEvent } from '#lib/components/team/home.ts';
	import Button from '#lib/ui/Button.svelte';
	import Table from '#lib/ui/Table.svelte';

	interface Props {
		rows: TodayEvent[];
		limit?: number;
	}

	let { rows, limit = 12 }: Props = $props();

	let expanded = $state(false);

	const shown = $derived(expanded ? rows : rows.slice(0, limit));
	const live = $derived(rows.filter((row) => row.state === 'live').length);
	const leaders = $derived(shown.some((row) => row.leader));
</script>

{#if live > 0}
	<p class="summary muted">
		{live} of {rows.length} running now
	</p>
{/if}

<div class={['events', { leaders }]}>
	<Table>
		<caption class="visually-hidden">Events running today</caption>
		<colgroup>
			<col class="event" />
			<col class="where" />
			<col class="day" />
			<col class="status" />
			{#if leaders}<col class="leader" />{/if}
		</colgroup>
		<thead>
			<tr>
				<th class="l" scope="col">Event</th>
				<th class="l where" scope="col">Where</th>
				<th class="l day" scope="col">Day</th>
				<th class="l" scope="col">Progress</th>
				{#if leaders}<th class="l leader" scope="col">Leader</th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each shown as row (row.code)}
				<tr class={row.state}>
					<td class="l name">
						<a href="/events/{row.code}">{row.name}</a>
						<span class="sub">{row.place} · {row.type}</span>
					</td>
					<td class="l where">{row.place}</td>
					<td class="l day">{row.dates}</td>
					<td class="l status">
						{#if row.state === 'live'}<span class="dot" aria-hidden="true"></span>{/if}{row.status}
						{#if row.leader}
							<span class="sub">
								{row.leaderLabel}
								<a href="/teams/{row.leader.team}">{row.leader.team}</a>
							</span>
						{/if}
					</td>
					{#if leaders}
						<td class="l leader">
							{#if row.leader}
								<span class="faint">{row.leaderLabel}</span>
								<a href="/teams/{row.leader.team}"
									><b>{row.leader.team}</b>
									{#if row.leader.name}<span class="team-name">{row.leader.name}</span>{/if}</a
								>
							{/if}
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</Table>
</div>

{#if rows.length > limit}
	<div class="more">
		<Button variant="secondary" aria-expanded={expanded} onclick={() => (expanded = !expanded)}>
			{expanded ? 'Show fewer' : `Show all ${rows.length}`}
		</Button>
	</div>
{/if}

<style>
	.summary {
		font-size: 14px;
	}

	.events :global(td) {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	col.event {
		width: 31%;
	}

	col.where {
		width: 17%;
	}

	col.day {
		width: 11%;
	}

	col.status {
		width: 15%;
	}

	col.leader {
		width: 26%;
	}

	.events:not(.leaders) col.event {
		width: 40%;
	}

	.events:not(.leaders) col.where {
		width: 24%;
	}

	.events:not(.leaders) col.day {
		width: 14%;
	}

	.events:not(.leaders) col.status {
		width: 22%;
	}

	tr.waiting .status,
	tr.done .status {
		color: var(--text-3);
	}

	tr.live .status {
		font-weight: 600;
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 7px;
		border-radius: 50%;
		background: var(--red);
		vertical-align: 2px;
	}

	.team-name {
		color: var(--text-2);
	}

	.leader b {
		font-weight: 600;
	}

	.sub {
		display: none;
		font-size: 13px;
		font-weight: 400;
		color: var(--text-2);
	}

	.more {
		display: flex;
	}

	@media (min-width: 641px) {
		.events :global(table.t) {
			table-layout: fixed;
		}
	}

	@media (max-width: 640px) {
		.name {
			white-space: normal;
		}

		.sub {
			display: block;
		}

		col.event {
			width: auto;
		}

		col.status {
			width: 1%;
		}

		.where,
		.day,
		.leader,
		col.where,
		col.day,
		col.leader {
			display: none;
		}
	}
</style>
