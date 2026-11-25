<script lang="ts" module>
	export type SeasonStanding = { opr: number; rank: number };
</script>

<script lang="ts">
	import type { TeamRating } from '#lib/analysis/types.ts';
	import { fixed, integer } from '#lib/format/number.ts';
	import { placeName } from '#lib/format/places.ts';
	import type { Ranking, Team } from '#lib/types.ts';
	import DataTable from '#lib/ui/DataTable.svelte';
	import type { Column, SortState } from '#lib/ui/data-table.ts';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import { teamHref } from './matches.ts';

	interface Props {
		teams: Team[];
		rankings?: Ranking[];
		ratings?: TeamRating[] | null;
		season?: Record<number, SeasonStanding> | null;
		seasonCount?: number | null;
		followed?: ReadonlySet<number>;
		eventCode?: string;
	}

	let {
		teams,
		rankings = [],
		ratings = null,
		season = null,
		seasonCount = null,
		followed = new Set(),
		eventCode
	}: Props = $props();

	let sort = $state<SortState | null>(null);

	const ranks = $derived(new Map(rankings.map((row) => [row.team, row])));
	const played = $derived(rankings.some((row) => row.played > 0));
	const opr = $derived(
		ratings ? new Map(ratings.map((rating) => [rating.team, rating.opr])) : null
	);
	const stats = $derived(ranks.size > 0 || opr !== null || season !== null);
	const sorted = $derived([...teams].sort((a, b) => a.number - b.number));

	function record(row: Ranking) {
		return `${row.wins}-${row.losses}-${row.ties}`;
	}

	function winShare(row: Ranking | undefined) {
		if (!row || row.played === 0) return null;
		return (row.wins + row.ties / 2) / row.played;
	}

	const columns = $derived.by(() => {
		const list: Column<Team>[] = [
			{
				key: 'team',
				label: 'Team',
				sort: (team) => team.number,
				cell: teamCell,
				class: 'team'
			},
			{
				key: 'location',
				label: 'Location',
				sort: (team) => placeName(team, 'short'),
				cell: place,
				hide: stats ? 'phone' : undefined
			},
			{
				key: 'rookie',
				label: 'Rookie year',
				numeric: true,
				first: 'asc',
				sort: (team) => team.rookieYear ?? null,
				text: (team) => (team.rookieYear ? String(team.rookieYear) : '—'),
				hide: 'phone'
			}
		];
		if (ranks.size > 0) {
			list.push({
				key: 'rank',
				label: 'Rank',
				numeric: true,
				first: 'asc',
				sort: (team) => ranks.get(team.number)?.rank ?? null,
				text: (team) => String(ranks.get(team.number)?.rank ?? '—')
			});
		}
		if (played) {
			list.push({
				key: 'record',
				label: 'Record',
				numeric: true,
				sort: (team) => winShare(ranks.get(team.number)),
				text: (team) => {
					const row = ranks.get(team.number);
					return row ? record(row) : '—';
				},
				hide: 'phone'
			});
		}
		if (opr) {
			const here = opr;
			list.push({
				key: 'opr',
				label: 'aOPR here',
				short: 'aOPR',
				class: 'pair',
				term: true,
				numeric: true,
				sort: (team) => here.get(team.number) ?? null,
				text: (team) => fixed(here.get(team.number))
			});
		}
		if (season) {
			const standings = season;
			list.push(
				{
					key: 'season',
					label: 'Season aOPR',
					short: 'Season',
					class: 'pair',
					term: true,
					numeric: true,
					sort: (team) => standings[team.number]?.opr ?? null,
					text: (team) => fixed(standings[team.number]?.opr)
				},
				{
					key: 'world',
					label: 'World rank',
					term: true,
					numeric: true,
					first: 'asc',
					sort: (team) => standings[team.number]?.rank ?? null,
					cell: worldRank,
					hide: 'phone'
				}
			);
		}
		return list;
	});

	function rowClass(team: Team) {
		return followed.has(team.number) ? 'me' : undefined;
	}
</script>

{#snippet teamCell(team: Team)}
	<TeamCell number={team.number} name={team.name} href={teamHref(team.number, eventCode)} />
{/snippet}

{#snippet place(team: Team)}
	<span class="muted">{placeName(team, 'short')}</span>
{/snippet}

{#snippet worldRank(team: Team)}
	{@const standing = season?.[team.number]}
	{#if standing}
		{integer(standing.rank)}{#if seasonCount}<span class="faint"
				>{` of ${integer(seasonCount)}`}</span
			>{/if}
	{:else}
		—
	{/if}
{/snippet}

<DataTable
	rows={sorted}
	{columns}
	rowKey={(team) => String(team.number)}
	{rowClass}
	bind:sort
	caption="Teams at this event"
	class="teams-table"
/>

<style>
	@media (max-width: 600px) {
		:global(.teams-table :is(th, td).num.pair) {
			width: 4.5rem;
		}
	}
</style>
