<script lang="ts">
	import Term from '#lib/ui/Term.svelte';
	import { follows, syncFollows } from '#lib/components/follow/follow.svelte.ts';
	import { integer, shortDate } from '#lib/format/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Table from '#lib/ui/Table.svelte';
	import {
		clearedRecords,
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
		sortable?: boolean;
		compact?: boolean;
		caption?: string;
	}

	let {
		rows,
		filters,
		names,
		sortable = true,
		compact = false,
		caption = 'Highest alliance scores this season'
	}: Props = $props();

	const followed = $derived(new Set(follows.teams));

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
	<Table>
		<caption class="visually-hidden">{caption}</caption>
		<thead>
			<tr>
				<th class="l" scope="col">Rank</th>
				{#each RECORD_PARTS as part (part.key)}
					{@const active = filters.part === part.key}
					<th
						scope="col"
						class={{
							optional: compact && part.key !== 'total',
							extra: part.key !== 'total' && !active,
							active
						}}
						aria-sort={active ? 'descending' : undefined}
					>
						{#if sortable}
							<a href={sortHref(part.key)} data-sveltekit-reset="false">
								<Term label={part.label} nested />{#if active}<span aria-hidden="true">
										↓</span
									>{/if}
							</a>
						{:else}
							<Term label={part.label} />
						{/if}
					</th>
				{/each}
				<th class="l" scope="col">Alliance</th>
				<th class="optional" scope="col">Opponent</th>
				<th class="l" scope="col">Event</th>
				<th class="l opt" scope="col">Match</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (`${row.event}:${row.key}:${row.alliance}`)}
				<tr class:me={row.teams.some((team) => followed.has(team))}>
					<td class="l">{integer(row.rank)}</td>
					{#each RECORD_PARTS as part (part.key)}
						<td
							class={{
								optional: compact && part.key !== 'total',
								extra: part.key !== 'total' && filters.part !== part.key,
								strong: filters.part === part.key
							}}>{integer(row[part.key])}</td
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
							>{row.label} {row.alliance === 'red' ? 'Red' : 'Blue'}</a
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
	th a {
		color: inherit;
	}

	th.active {
		color: var(--text);
	}

	td.strong {
		font-weight: 600;
	}

	.teams {
		display: grid;
		gap: 2px;
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
		margin-left: 6px;
		font-size: 12.5px;
	}

	.side.red {
		color: var(--red);
	}

	.side.blue {
		color: var(--blue);
	}

	@media (max-width: 900px) {
		.extra {
			display: none;
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
