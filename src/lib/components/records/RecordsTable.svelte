<script lang="ts">
	import Brand from '#lib/ui/Brand.svelte';
	import Arrow from '#lib/ui/Arrow.svelte';
	import Term from '#lib/ui/Term.svelte';
	import { follows, syncFollows } from '#lib/components/follow/follow.svelte.ts';
	import { integer, shortDate, signed } from '#lib/format/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Table from '#lib/ui/Table.svelte';
	import {
		clearedRecords,
		RECORD_GROUPS,
		RECORD_PART_NOTES,
		RECORD_PARTS,
		recordQuery,
		shownParts,
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

	const columns = $derived(
		shownParts(filters).map((key, index, all) => {
			const part = RECORD_PARTS.find((entry) => entry.key === key) ?? RECORD_PARTS[0];
			const before = index > 0 ? RECORD_PARTS.find((entry) => entry.key === all[index - 1]) : null;
			return {
				key,
				label: part.label,
				group: part.group,
				first: before !== null && before?.group !== part.group,
				lone: key !== 'total' && key !== filters.part
			};
		})
	);

	const groups = $derived(
		RECORD_GROUPS.map((group) => ({
			...group,
			span: columns.filter((column) => column.group === group.key).length
		})).filter((group) => group.span > 0)
	);

	const custom = $derived(filters.show !== null);

	$effect(() => syncFollows());

	function sortHref(part: RecordPart) {
		const dir = part === filters.part && filters.dir === 'desc' ? 'asc' : 'desc';
		return `/records${recordQuery({ ...filters, part, dir }, 1)}`;
	}

	function value(row: RankedRecord, key: RecordPart) {
		return key === 'margin' ? signed(row.margin, 0) : integer(row[key]);
	}
</script>

{#if rows.length === 0}
	<EmptyState title="No scores match these filters.">
		<a href={clearedRecords(filters)}>Clear filters</a>
	</EmptyState>
{:else}
	<Table class={custom ? 'records custom' : 'records'}>
		<caption class="visually-hidden">Highest alliance scores this season</caption>
		<thead>
			<tr class="groups">
				<td></td>
				{#each groups as group, index (group.key)}
					<th class={['group', { sep: index > 0 }]} scope="colgroup" colspan={group.span}
						>{group.label}</th
					>
				{/each}
				<td colspan="3"></td>
			</tr>
			<tr>
				<th class="l rank" scope="col">Rank</th>
				{#each columns as column (column.key)}
					{@const active = filters.part === column.key}
					<th
						scope="col"
						class={['num', { extra: column.lone, sep: column.first, active }]}
						aria-sort={active ? (filters.dir === 'asc' ? 'ascending' : 'descending') : undefined}
						title={RECORD_PART_NOTES[column.key]}
					>
						<a class="sort-link" href={sortHref(column.key)} data-sveltekit-reset="false"
							><Arrow
								dir={active && filters.dir === 'asc' ? 'up' : 'down'}
								class="sort-arrow"
							/><Term label={column.label} nested /></a
						>
					</th>
				{/each}
				<th class="l" scope="col">Alliance</th>
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
							class={[
								'num',
								{
									extra: column.lone,
									sep: column.first,
									active: filters.part === column.key,
									strong: column.key === 'total',
									muted: column.key === 'opponent' && filters.part !== 'opponent'
								}
							]}>{value(row, column.key)}</td
						>
					{/each}
					<td class="l team">
						<span class="teams">
							{#each row.teams as team (team)}
								<a href="/teams/{team}"
									><b>{team}</b>
									{#if names.teams[team]}<span class="name">{names.teams[team]}</span>{/if}</a
								>
							{/each}
						</span>
					</td>
					<td class="l event">
						<a class="event-name" href="/events/{row.event}"
							><Brand text={names.events[row.event] ?? row.event} /></a
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
	th a {
		color: inherit;
	}

	th.num,
	td.num {
		width: 1%;
		padding-inline: 12px;
	}

	thead tr:last-child th {
		padding-top: 8px;
	}

	th.group {
		padding: 0 12px 6px;
	}

	.sort-link {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	th :global(.sort-arrow) {
		margin: 0;
		opacity: 0.3;
	}

	th.num a:hover :global(.sort-arrow) {
		opacity: 0.7;
	}

	th.active {
		color: var(--text);
		font-weight: 600;
	}

	th.active :global(.sort-arrow) {
		opacity: 1;
	}

	thead th.active,
	tbody tr:not(.me) td.active {
		background: var(--surface);
	}

	tbody td {
		padding-block: 7px;
		line-height: 1.3;
	}

	td.strong,
	td.active {
		font-weight: 600;
	}

	th.rank,
	td.rank {
		width: 1%;
		padding-right: 4px;
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

	td.team {
		padding-left: 16px;
	}

	thead tr:last-child th.num + th.l {
		padding-left: 16px;
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
		:global(.records:not(.custom)) .extra,
		:global(.records:not(.custom)) .groups {
			display: none;
		}

		:global(.records:not(.custom)) .sep {
			border-left: 0;
		}
	}

	@media (max-width: 760px) {
		.teams a,
		.event {
			max-width: 180px;
		}
	}

	@media (max-width: 600px) {
		th.num,
		td.num {
			padding-inline: 6px;
		}

		.event {
			max-width: calc(100vw - 188px);
		}

		.name {
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
