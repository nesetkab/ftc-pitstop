<script lang="ts">
	import { RP_THRESHOLDS } from '#lib/game/biobuzz.ts';
	import { fixed } from '#lib/format/number.ts';
	import type { Ranking, Team } from '#lib/types.ts';
	import { heatBackground } from '#lib/ui/heat.ts';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import type { RpCounts } from './standings.ts';

	interface Props {
		rp: Record<number, RpCounts>;
		rankings: Ranking[];
		teams: Team[];
		followed?: ReadonlySet<number>;
	}

	let { rp, rankings, teams, followed = new Set() }: Props = $props();

	const share = (rate: number) => `${Math.round(rate * 100)}%`;

	const names = $derived(new Map(teams.map((team) => [team.number, team.name])));
	const rows = $derived(
		rankings.flatMap((row) => {
			const counts = rp[row.team];
			if (!counts || counts.played === 0) return [];
			const rate = (value: number) => value / counts.played;
			return [
				{
					rank: row.rank,
					team: row.team,
					name: names.get(row.team) ?? row.name,
					rs: row.rs,
					win: rate(counts.wins),
					swarm: rate(counts.swarm),
					pollinator1: rate(counts.pollinator1),
					pollinator2: rate(counts.pollinator2),
					bonus: rate(counts.swarm + counts.pollinator1 + counts.pollinator2)
				}
			];
		})
	);
</script>

<div class="rp">
	<Table>
		<caption class="visually-hidden">Where ranking points came from</caption>
		<thead>
			<tr>
				<th class="l opt" scope="col">Rank</th>
				<th class="l" scope="col">Team</th>
				<th class="opt" scope="col">RS</th>
				<th scope="col">Won</th>
				<th scope="col"><abbr title="Leave and park {RP_THRESHOLDS.swarm}+ points">Swarm</abbr></th>
				<th scope="col"
					><abbr title="Pollinator 1, {RP_THRESHOLDS.pollinator1}+ tips">Poll. 1</abbr></th
				>
				<th scope="col"
					><abbr title="Pollinator 2, {RP_THRESHOLDS.pollinator2}+ tips">Poll. 2</abbr></th
				>
				<th class="opt" scope="col">Bonus RS</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.team)}
				<tr class:me={followed.has(row.team)}>
					<td class="l opt">{row.rank}</td>
					<td class="team">
						<TeamCell number={row.team} name={row.name} href="/teams/{row.team}" />
					</td>
					<td class="opt">{fixed(row.rs, 2)}</td>
					{#each [row.win, row.swarm, row.pollinator1, row.pollinator2] as rate, index (index)}
						<td style:background={heatBackground(rate)}>{share(rate)}</td>
					{/each}
					<td class="opt">{fixed(row.bonus, 2)}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
</div>

<style>
	.rp {
		max-width: 860px;
	}
</style>
