<script lang="ts">
	import Term from '#lib/ui/Term.svelte';
	import type { RankedRecord } from '#lib/components/records/records.ts';
	import { integer } from '#lib/format/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import {
		INSIGHT_PARTS,
		insightQuery,
		type InsightFilters,
		type InsightPart
	} from './insights.ts';
	import { matchHref } from './matches.ts';

	interface Props {
		code: string;
		rows: RankedRecord[];
		filters: InsightFilters;
		followed?: ReadonlySet<number>;
	}

	let { code, rows, filters, followed = new Set() }: Props = $props();

	function sortHref(sort: InsightPart) {
		return `/events/${code}/insights${insightQuery({ ...filters, sort })}`;
	}
</script>

{#if rows.length === 0}
	<EmptyState title="No scores yet.">Scores show here as soon as matches are played.</EmptyState>
{:else}
	<Table>
		<caption class="visually-hidden">Highest alliance scores at this event</caption>
		<thead>
			<tr>
				<th class="l" scope="col">Rank</th>
				{#each INSIGHT_PARTS as part (part.key)}
					{@const active = filters.sort === part.key}
					<th
						scope="col"
						class={{ opt: part.key !== 'total' && !active, active }}
						aria-sort={active ? 'descending' : undefined}
					>
						<a href={sortHref(part.key)} data-sveltekit-noscroll>
							<Term label={part.label} />{#if active}<span aria-hidden="true"> ↓</span>{/if}
						</a>
					</th>
				{/each}
				<th class="l" scope="col">Alliance</th>
				<th class="l" scope="col">Match</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (`${row.key}:${row.alliance}`)}
				<tr>
					<td class="l">{integer(row.rank)}</td>
					{#each INSIGHT_PARTS as part (part.key)}
						{@const active = filters.sort === part.key}
						<td class={{ opt: part.key !== 'total' && !active, strong: active }}>
							{integer(row[part.key])}
						</td>
					{/each}
					<td class="l">
						<span class="chips">
							{#each row.teams as team (team)}
								<TeamChip
									number={team}
									alliance={row.alliance}
									me={followed.has(team)}
									href="/teams/{team}"
								/>
							{/each}
						</span>
					</td>
					<td class="l">
						<a class="match" href={matchHref(code, row)}>{row.label}</a>
						<span class="faint opp">vs {integer(row.opponent)}</span>
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

	.chips {
		display: inline-flex;
		gap: 4px;
	}

	.match {
		font-weight: 600;
	}

	.opp {
		margin-left: 6px;
		font-size: 12.5px;
	}

	@media (max-width: 600px) {
		.opp {
			display: none;
		}
	}
</style>
