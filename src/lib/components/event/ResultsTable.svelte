<script lang="ts">
	import { breakdownParts, PART_LABELS } from '#lib/game/biobuzz.ts';
	import type { AllianceColor, AllianceScore, Match } from '#lib/types.ts';
	import Table from '#lib/ui/Table.svelte';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import { matchHref } from './matches.ts';

	type Order = 'asc' | 'desc';

	interface Props {
		code: string;
		matches: Match[];
		followed?: ReadonlySet<number>;
		order?: Order;
	}

	let { code, matches, followed = new Set(), order = $bindable('asc') }: Props = $props();

	const played = $derived(matches.filter((match) => match.result !== null));
	const rows = $derived(order === 'asc' ? played : [...played].reverse());

	const parts = ['auto', 'hive', 'flower', 'garden', 'park'] as const;

	function sides(match: Match): { color: AllianceColor; score: AllianceScore }[] {
		if (!match.result) return [];
		return [
			{ color: 'red', score: match.result.red },
			{ color: 'blue', score: match.result.blue }
		];
	}

	function flip() {
		order = order === 'asc' ? 'desc' : 'asc';
	}
</script>

<Table>
	<caption class="visually-hidden">Match results</caption>
	<thead>
		<tr>
			<th class="l" scope="col" aria-sort={order === 'asc' ? 'ascending' : 'descending'}>
				<button type="button" class="sort" onclick={flip}>
					Match <span aria-hidden="true">{order === 'asc' ? '↑' : '↓'}</span>
					<span class="visually-hidden"
						>, sorted {order === 'asc' ? 'first to last' : 'last to first'}</span
					>
				</button>
			</th>
			<th class="l" scope="col">Teams</th>
			<th scope="col">{PART_LABELS.auto}</th>
			<th class="opt" scope="col">{PART_LABELS.hive}</th>
			<th class="opt" scope="col">{PART_LABELS.flower}</th>
			<th class="opt" scope="col">{PART_LABELS.garden}</th>
			<th class="opt" scope="col">{PART_LABELS.park}</th>
			<th class="opt" scope="col">{PART_LABELS.fouls}</th>
			<th scope="col">{PART_LABELS.total}</th>
		</tr>
	</thead>
	{#each rows as match (match.key)}
		<tbody>
			{#each sides(match) as { color, score }, index (color)}
				{@const split = breakdownParts(score)}
				{@const detailed = score.breakdown !== null}
				<tr class={['side', color, { first: index === 0 }]}>
					{#if index === 0}
						<th class="l match" rowspan="2" scope="rowgroup">
							<a href={matchHref(code, match)}>{match.label}</a>
						</th>
					{/if}
					<td class="l">
						<span class={['side-name', color]}>{color === 'red' ? 'Red' : 'Blue'}</span>
						<span class="chips">
							{#each match[color] as entry (entry.team)}
								<TeamChip number={entry.team} alliance={color} me={followed.has(entry.team)} />
							{/each}
						</span>
					</td>
					{#each parts as part (part)}
						<td class={{ opt: part !== 'auto' }}
							>{detailed || part === 'auto' ? split[part] : '—'}</td
						>
					{/each}
					<td class="opt">{split.fouls}</td>
					<td class={['total', { won: match.result?.winner === color }]}>
						{score.total}{#if match.result?.winner === color}<span class="visually-hidden"
								>, won</span
							>{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	{/each}
</Table>

<style>
	.sort {
		display: inline-flex;
		gap: 4px;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
	}

	.sort:hover {
		color: var(--text);
	}

	@media (pointer: coarse) {
		.sort {
			margin-block: -11px;
			padding-block: 11px;
		}
	}

	th.match {
		padding: 11px 10px 9px;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		color: var(--text);
		vertical-align: top;
		text-align: left;
	}

	th.match a {
		font-weight: 600;
	}

	tr.first td {
		padding-bottom: 3px;
		border-bottom-color: transparent;
	}

	tr.side:not(.first) td {
		padding-top: 3px;
	}

	.side-name {
		display: inline-block;
		width: 2.6em;
		font-size: 12.5px;
		font-weight: 500;
	}

	.side-name.red {
		color: var(--red);
	}

	.side-name.blue {
		color: var(--blue);
	}

	.chips {
		display: inline-flex;
		gap: 4px;
	}

	.total {
		color: var(--text-2);
	}

	.total.won {
		color: var(--text);
		font-weight: 600;
	}
</style>
