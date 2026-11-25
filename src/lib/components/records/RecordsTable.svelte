<script lang="ts">
	import Term from '#lib/ui/Term.svelte';
	import { follows, syncFollows } from '#lib/components/follow/follow.svelte.ts';
	import { integer, shortDate } from '#lib/format/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Table from '#lib/ui/Table.svelte';
	import {
		clearedRecords,
		RECORD_GROUPS,
		RECORD_PARTS,
		recordQuery,
		type RankedRecord,
		type RecordFilters,
		type RecordPart
	} from './records.ts';

	interface Props {
		rows: RankedRecord[];
		filters: RecordFilters;
		names: { teams: Record<number, string>; events: Record<string, string> };
	}

	let { rows, filters, names }: Props = $props();

	const followed = $derived(new Set(follows.teams));

	const columns = RECORD_GROUPS.flatMap((group) =>
		group.parts.map((key, index) => ({
			key,
			label: RECORD_PARTS.find((part) => part.key === key)?.label ?? key,
			first: index === 0 && group !== RECORD_GROUPS[0]
		}))
	);

	$effect(() => syncFollows());

	function sortHref(part: RecordPart) {
		return `/records${recordQuery({ ...filters, part }, 1)}`;
	}
</script>

{#if rows.length === 0}
	<EmptyState title="No scores match these filters.">
		<a href={clearedRecords(filters)}>Clear filters</a>
	</EmptyState>
{:else}
	<Table class="records">
		<caption class="visually-hidden">Highest alliance scores this season</caption>
		<thead>
			<tr class="groups">
				<td></td>
				{#each RECORD_GROUPS as group, index (group.label)}
					<th class={['group', { sep: index > 0 }]} scope="colgroup" colspan={group.parts.length}
						>{group.label}</th
					>
				{/each}
				<td colspan="4"></td>
			</tr>
			<tr>
				<th class="l" scope="col">Rank</th>
				{#each columns as column (column.key)}
					{@const active = filters.part === column.key}
					<th
						scope="col"
						class={{ extra: column.key !== 'total' && !active, sep: column.first, active }}
						aria-sort={active ? 'descending' : undefined}
					>
						<a class="sort-link" href={sortHref(column.key)} data-sveltekit-reset="false"
							><Term label={column.label} nested /><span class="arrow" aria-hidden="true">↓</span
							></a
						>
					</th>
				{/each}
				<th class="l" scope="col">Alliance</th>
				<th class="optional" scope="col">Opponent</th>
				<th class="l" scope="col">Event</th>
				<th class="l opt" scope="col">Match</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row, index (`${row.event}:${row.key}:${row.alliance}`)}
				<tr class:me={row.teams.some((team) => followed.has(team))}>
					<td class={['l rank', { tied: index > 0 && rows[index - 1].rank === row.rank }]}
						>{integer(row.rank)}</td
					>
					{#each columns as column (column.key)}
						<td
							class={{
								extra: column.key !== 'total' && filters.part !== column.key,
								sep: column.first,
								active: filters.part === column.key,
								total: column.key === 'total'
							}}>{integer(row[column.key])}</td
						>
					{/each}
					<td class={['l team', { bare: filters.part !== 'total' }]}>
						<span class="teams">
							{#each row.teams as team (team)}
								<a href="/teams/{team}"
									><b>{team}</b>
									{#if names.teams[team]}<span class="name">{names.teams[team]}</span>{/if}</a
								>
							{/each}
						</span>
					</td>
					<td class="optional muted">{integer(row.opponent)}</td>
					<td class="l event">
						<a class="event-name" href="/events/{row.event}"
							>{names.events[row.event] ?? row.event}</a
						>
						<span class="date">{shortDate(row.day)}</span>
						<a class="phone" href="/events/{row.event}/matches/{row.key}"
							>{row.label}
							<span class={['side', row.alliance]}>{row.alliance === 'red' ? 'Red' : 'Blue'}</span
							></a
						>
					</td>
					<td class="l opt">
						<a class="match" href="/events/{row.event}/matches/{row.key}">{row.label}</a>
						<span class={['side', row.alliance]}>{row.alliance === 'red' ? 'Red' : 'Blue'}</span>
					</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}

<style>
	:global(.records) {
		--sort-hint: '';
	}

	th a {
		color: inherit;
	}

	.arrow {
		margin-left: 3px;
		opacity: 0.35;
	}

	th.active {
		color: var(--text);
		font-weight: 600;
	}

	th.active .arrow {
		opacity: 1;
	}

	thead th.active,
	tbody tr:not(.me) td.active {
		background: var(--surface);
	}

	tbody td {
		padding-block: 6px;
		line-height: 1.3;
	}

	td.total,
	td.active {
		font-weight: 600;
	}

	td.rank {
		color: var(--text-2);
	}

	td.rank.tied {
		color: transparent;
	}

	.muted {
		color: var(--text-2);
	}

	.teams {
		display: grid;
	}

	.teams a {
		display: block;
		max-width: 240px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.teams b {
		font-weight: 600;
	}

	.name {
		margin-left: 4px;
		color: var(--text-2);
	}

	.event {
		max-width: 260px;
	}

	.event-name {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.date {
		font-size: 12.5px;
		color: var(--text-3);
	}

	.match {
		font-weight: 600;
	}

	.phone {
		display: none;
	}

	.side {
		margin-left: 4px;
		font-size: 12.5px;
	}

	.side.red {
		color: var(--red);
	}

	.side.blue {
		color: var(--blue);
	}

	@media (max-width: 900px) {
		.extra,
		.groups {
			display: none;
		}

		.sep {
			border-left: 0;
		}
	}

	@media (max-width: 760px) {
		.optional {
			display: none;
		}

		.teams a,
		.event {
			max-width: 180px;
		}
	}

	@media (max-width: 600px) {
		.teams a {
			max-width: 34vw;
		}

		.event {
			max-width: 34vw;
		}

		.bare .name {
			display: none;
		}

		.phone {
			display: inline;
			margin-left: 4px;
			font-size: 12.5px;
			font-weight: 600;
		}
	}
</style>
