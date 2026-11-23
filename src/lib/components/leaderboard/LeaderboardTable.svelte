<script lang="ts">
	import { oprTerm } from '#lib/format/glossary.ts';
	import Term from '#lib/ui/Term.svelte';
	import { fixed, integer, MISSING } from '#lib/format/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import { follows, syncFollows } from '#lib/components/follow/follow.svelte.ts';
	import {
		queryString,
		type LeaderboardFilters,
		type LeaderboardRow,
		type LeaderboardSort
	} from './leaderboard.ts';
	import { placeName } from '#lib/format/places.ts';

	interface Props {
		rows: LeaderboardRow[];
		start: number;
		filters?: LeaderboardFilters;
		caption?: string;
	}

	let { rows, start, filters, caption = 'Teams ranked by season OPR' }: Props = $props();

	const followed = $derived(new Set(follows.teams));
	const showEvents = $derived(rows.some((row) => row.events !== null));
	const sort = $derived(filters?.sort ?? 'opr');
	const columns: { key: LeaderboardSort; label: string; optional?: boolean }[] = [
		{ key: 'opr', label: 'OPR' },
		{ key: 'auto', label: 'Auto' },
		{ key: 'teleop', label: 'Teleop' },
		{ key: 'tips', label: 'Tips', optional: true },
		{ key: 'matches', label: 'Matches', optional: true }
	];

	const extra = $derived(columns.some((column) => column.optional && column.key === sort));

	$effect(() => syncFollows());

	function hidden(column: (typeof columns)[number]): boolean {
		if (column.key === sort) return false;
		return Boolean(column.optional) || (extra && column.key === 'teleop');
	}

	function sortHref(key: LeaderboardSort) {
		return filters ? `/leaderboards${queryString({ ...filters, sort: key }, 1)}` : undefined;
	}

	function value(row: LeaderboardRow, key: LeaderboardSort): string {
		return key === 'matches' ? integer(row.matches) : fixed(row[key]);
	}
</script>

{#if rows.length === 0}
	<EmptyState title="No teams match these filters.">Try other filters.</EmptyState>
{:else}
	<Table>
		<caption class="visually-hidden">{caption}</caption>
		<thead>
			<tr>
				<th class="l" scope="col">Rank</th>
				<th class="l" scope="col">Team</th>
				<th class="l optional" scope="col">Location</th>
				{#each columns as column (column.key)}
					{@const active = sort === column.key}
					<th
						scope="col"
						class={{ optional: hidden(column), active }}
						aria-sort={active ? 'descending' : undefined}
					>
						{#if filters}
							<a href={sortHref(column.key)} data-sveltekit-reset="false">
								<Term label={column.label} term={oprTerm(column.label)} nested />{#if active}<span
										aria-hidden="true"
									>
										↓</span
									>{/if}
							</a>
						{:else}
							<Term label={column.label} term={oprTerm(column.label)} />
						{/if}
					</th>
				{/each}
				{#if showEvents}
					<th class="optional roomy" scope="col">Events</th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each rows as row, index (row.team)}
				{@const link = `/teams/${row.team}`}
				{@const target = filters?.team === row.team}
				<tr
					class:me={followed.has(row.team)}
					class:target
					aria-current={target ? 'true' : undefined}
				>
					<td class="l">{integer(start + index + 1)}</td>
					<td class="team">
						<div class="team-name"><TeamCell number={row.team} name={row.name} href={link} /></div>
					</td>
					<td class="l optional">{placeName(row, 'short') || MISSING}</td>
					{#each columns as column (column.key)}
						<td
							class={{
								optional: hidden(column),
								active: sort === column.key
							}}
						>
							{value(row, column.key)}
						</td>
					{/each}
					{#if showEvents}
						<td class="optional roomy">{row.events === null ? MISSING : integer(row.events)}</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}

<style>
	.team-name {
		max-width: 320px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	th a {
		color: inherit;
	}

	th.active,
	td.active {
		color: var(--text);
		font-weight: 600;
	}

	tr.target td {
		box-shadow:
			inset 0 1px 0 var(--text),
			inset 0 -1px 0 var(--text);
	}

	tr.target td:first-child {
		box-shadow:
			inset 2px 0 0 var(--text),
			inset 0 1px 0 var(--text),
			inset 0 -1px 0 var(--text);
	}

	@media (max-width: 900px) {
		.roomy {
			display: none;
		}
	}

	@media (max-width: 640px) {
		.optional {
			display: none;
		}
	}
</style>
