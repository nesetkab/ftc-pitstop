<script lang="ts">
	import { ordinal } from '#lib/format/ordinal.ts';
	import type { Team } from '#lib/types.ts';
	import Arrow from '#lib/ui/Arrow.svelte';
	import FinishSpark from '#lib/ui/FinishSpark.svelte';
	import ProbCell from '#lib/ui/ProbCell.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import Term from '#lib/ui/Term.svelte';
	import { teamHref } from './matches.ts';
	import {
		cellText,
		defaultDir,
		phoneHidden,
		sortBy,
		type ColumnKey,
		type RankingChoice,
		type RankingColumn,
		type RankingRow,
		type SortKey
	} from './ranking-columns.ts';

	interface Props {
		rows: RankingRow[];
		teams: Team[];
		columns: RankingColumn[];
		choice: RankingChoice;
		projected?: boolean;
		qualCount?: number;
		hrefFor: (choice: RankingChoice) => string;
		onchoose?: (choice: RankingChoice) => void;
		followed?: ReadonlySet<number>;
		eventCode?: string;
	}

	let {
		rows,
		teams,
		columns,
		choice,
		projected = false,
		qualCount = 0,
		hrefFor,
		onchoose,
		followed = new Set(),
		eventCode
	}: Props = $props();

	const names = $derived(new Map(teams.map((team) => [team.number, team.name])));

	function ariaSort(key: SortKey) {
		if (choice.sort !== key) return undefined;
		return choice.dir === 'asc' ? 'ascending' : 'descending';
	}

	function choose(event: MouseEvent, key: SortKey) {
		if (!onchoose || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		onchoose(sortBy(choice, key));
	}

	function hidden(key: ColumnKey) {
		return phoneHidden(key, choice, projected);
	}
</script>

{#snippet sorter(key: SortKey, label: string)}
	<a
		class="sort-link"
		href={hrefFor(sortBy(choice, key))}
		onclick={(event) => choose(event, key)}
		data-sveltekit-replacestate
		data-sveltekit-reset="false"
	>
		<Term {label} nested />{#if choice.sort === key}<Arrow
				dir={choice.dir === 'asc' ? 'up' : 'down'}
				class="sort-arrow"
			/>{:else}<Arrow dir={defaultDir(key) === 'asc' ? 'up' : 'down'} class="sort-hint" />{/if}
	</a>
{/snippet}

<Table class="rankings">
	<caption class="visually-hidden">Rankings</caption>
	<thead>
		{#if projected}
			<tr class="opt">
				<td class="pin rank"></td>
				<td class="pin team"></td>
				<td colspan={columns.length}></td>
				<th colspan="3" scope="colgroup" class="group sep">Projected after {qualCount} matches</th>
			</tr>
		{/if}
		<tr>
			<th class="l pin rank" scope="col" aria-sort={ariaSort('rank')}
				>{@render sorter('rank', 'Rank')}</th
			>
			<th class="l pin team" scope="col" aria-sort={ariaSort('team')}
				>{@render sorter('team', 'Team')}</th
			>
			{#each columns as column (column.key)}
				{@const key = column.key as ColumnKey}
				<th
					class={{ opt: hidden(key), active: choice.sort === key }}
					scope="col"
					aria-sort={ariaSort(key)}
				>
					{@render sorter(key, column.label)}
				</th>
			{/each}
			{#if projected}
				<th
					class={{ sep: true, opt: choice.sort !== 'finish', active: choice.sort === 'finish' }}
					scope="col"
					aria-sort={ariaSort('finish')}
				>
					{@render sorter('finish', `Finish, 1st to ${ordinal(rows.length)}`)}
				</th>
				<th
					class={{ opt: choice.sort !== 'top4', active: choice.sort === 'top4' }}
					scope="col"
					aria-sort={ariaSort('top4')}
				>
					{@render sorter('top4', 'Top 4')}
				</th>
				<th class={{ active: choice.sort === 'top8' }} scope="col" aria-sort={ariaSort('top8')}>
					{@render sorter('top8', 'Top 8')}
				</th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.ranking.team)}
			{@const team = row.ranking.team}
			<tr class:me={followed.has(team)}>
				<td class="l pin rank">{row.ranking.rank}</td>
				<td class="pin team">
					<TeamCell
						number={team}
						name={names.get(team) ?? row.ranking.name}
						href={teamHref(team, eventCode)}
					/>
				</td>
				{#each columns as column (column.key)}
					<td class={{ opt: hidden(column.key as ColumnKey), strong: choice.sort === column.key }}>
						{cellText(column, row)}
					</td>
				{/each}
				{#if projected}
					<td class={{ sep: true, opt: choice.sort !== 'finish' }}>
						{#if row.projection}
							<FinishSpark dist={row.projection.rankChances} />
						{/if}
					</td>
					<ProbCell p={row.projection?.top4} class={choice.sort === 'top4' ? undefined : 'opt'} />
					<ProbCell p={row.projection?.top8} />
				{/if}
			</tr>
		{/each}
	</tbody>
</Table>

<style>
	th.active {
		color: var(--text);
	}

	td.strong {
		font-weight: 600;
	}

	.pin {
		position: sticky;
		z-index: 1;
		background: var(--bg);
	}

	.rank {
		left: 0;
		box-sizing: border-box;
		width: var(--rank-w);
		min-width: var(--rank-w);
		max-width: var(--rank-w);
	}

	.team {
		left: var(--rank-w);
	}

	tr.me .pin {
		background-color: var(--bg);
		background-image: linear-gradient(var(--accent-wash), var(--accent-wash));
	}

	:global(.table-wrap.rankings) {
		--rank-w: 64px;
	}

	@media (max-width: 600px) {
		:global(.table-wrap.rankings) {
			--rank-w: 54px;
		}

		th.rank {
			white-space: nowrap;
		}

		td.team,
		th.team {
			box-shadow: inset -1px 0 var(--line);
		}

		td.team :global(.team-cell .name) {
			max-width: min(8em, 24vw);
		}
	}
</style>
