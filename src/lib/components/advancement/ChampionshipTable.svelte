<script lang="ts">
	import Brand from '#lib/ui/Brand.svelte';
	import { integer } from '#lib/format/number.ts';
	import { shortDate, shortRange } from '#lib/format/time.ts';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import type { ChampionshipRow } from './advancement.ts';

	interface Props {
		caption: string;
		rows: ChampionshipRow[];
		followed: ReadonlySet<number>;
		region: string | null;
	}

	let { caption, rows, followed, region }: Props = $props();

	const query = $derived(region ? `?region=${region}` : '');

	function yours(row: ChampionshipRow): number[] {
		return row.teams.filter((team) => followed.has(team));
	}
</script>

<div class="table-wrap">
	<table class="t champs">
		<caption class="visually-hidden">{caption}</caption>
		<thead>
			<tr>
				<th class="l" scope="col">Championship</th>
				<th class="l dates" scope="col">Dates</th>
				<th scope="col">Advanced</th>
				<th scope="col">Events played</th>
				<th class="l next" scope="col">Next event</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.code)}
				{@const mine = yours(row)}
				<tr class={{ me: mine.length > 0 }}>
					<td class="l name">
						<a href="/advancement/{row.code}{query}"><Brand text={row.name} /></a>
						<span class="sub">
							{row.place ?? ''}
							{#if row.start && row.end}
								<span class="phone">{row.place ? '· ' : ''}{shortRange(row.start, row.end)}</span>
							{/if}
						</span>
						{#if mine.length > 0}
							<span class="mine">
								{#each mine as team (team)}
									<TeamChip number={team} me href="/teams/{team}" />
								{/each}
							</span>
						{/if}
					</td>
					<td class="l dates muted">
						{row.start && row.end ? shortRange(row.start, row.end) : 'Not listed'}
					</td>
					<td class="n">{integer(row.advanced)}</td>
					<td class="n played">
						{integer(row.played)} of {integer(row.feeders)}
						{#if row.pending > 0}
							<span class="faint pending">{integer(row.pending)} pending</span>
						{/if}
					</td>
					<td class="l next">
						{#if row.next}
							<a href="/events/{row.next.code}"><Brand text={row.next.name} /></a>
							<span class="faint when">{shortDate(row.next.start)}</span>
						{:else if row.unposted > 0}
							<span class="faint">
								{integer(row.unposted)} more with no destination posted
							</span>
						{:else}
							<span class="faint">None left</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-wrap {
		overflow-x: auto;
	}

	.name {
		white-space: normal;
		min-width: 220px;
	}

	.name a {
		font-weight: 500;
	}

	.sub {
		display: block;
		font-size: 13px;
		color: var(--text-2);
	}

	.phone {
		display: none;
	}

	.mine {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 4px;
		font-size: 13px;
	}

	.played {
		white-space: nowrap;
	}

	.pending {
		display: block;
		font-size: 12.5px;
	}

	.next {
		white-space: normal;
		max-width: 300px;
	}

	.when {
		margin-left: 6px;
		white-space: nowrap;
	}

	@media (max-width: 900px) {
		.next {
			display: none;
		}
	}

	@media (max-width: 760px) {
		.dates {
			display: none;
		}

		.phone {
			display: inline;
		}

		.name {
			min-width: 0;
		}
	}
</style>
