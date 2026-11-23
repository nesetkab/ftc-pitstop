<script lang="ts">
	import type { MatchForecast } from '#lib/analysis/types.ts';
	import { RP_THRESHOLDS } from '#lib/game/biobuzz.ts';
	import { fixed } from '#lib/format/number.ts';
	import { pct } from '#lib/format/pct.ts';
	import type { AllianceColor, MatchResult } from '#lib/types.ts';
	import Table from '#lib/ui/Table.svelte';

	interface Props {
		forecast?: MatchForecast | null;
		result?: MatchResult | null;
		measure?: string;
	}

	let { forecast = null, result = null, measure }: Props = $props();

	type Key = 'win' | 'swarm' | 'pollinator1' | 'pollinator2';

	const rows: { key: Key; label: string }[] = [
		{ key: 'win', label: 'Win' },
		{ key: 'swarm', label: `Swarm, leave and park ${RP_THRESHOLDS.swarm}+` },
		{ key: 'pollinator1', label: `Pollinator 1, ${RP_THRESHOLDS.pollinator1}+ tips` },
		{ key: 'pollinator2', label: `Pollinator 2, ${RP_THRESHOLDS.pollinator2}+ tips` }
	];

	const colors: AllianceColor[] = ['red', 'blue'];

	function earned(color: AllianceColor, key: Key): string {
		if (!result) return '';
		if (key === 'win') {
			if (result.winner === null) return 'Tie';
			return result.winner === color ? 'Yes' : 'No';
		}
		const rp = result[color].breakdown?.rp;
		if (!rp) return '—';
		return rp[key] ? 'Yes' : 'No';
	}
</script>

<Table>
	<caption class="visually-hidden">Ranking points</caption>
	<thead>
		{#if result && forecast}
			<tr>
				<td></td>
				<th colspan="2" scope="colgroup" class="group">Red</th>
				<th colspan="2" scope="colgroup" class="group sep">Blue</th>
			</tr>
			<tr>
				<th class="l" scope="col"><span class="visually-hidden">Ranking point</span></th>
				<th scope="col">Earned</th>
				<th scope="col">Chance</th>
				<th scope="col" class="sep">Earned</th>
				<th scope="col">Chance</th>
			</tr>
		{:else}
			<tr>
				<th class="l" scope="col">
					{#if measure}{measure}{:else}<span class="visually-hidden">Ranking point</span>{/if}
				</th>
				<th scope="col">Red</th>
				<th scope="col">Blue</th>
			</tr>
		{/if}
	</thead>
	<tbody>
		{#each rows as row (row.key)}
			<tr>
				<td class="l wrap">{row.label}</td>
				{#each colors as color (color)}
					{#if result}
						<td class:sep={color === 'blue' && forecast !== null}>{earned(color, row.key)}</td>
					{/if}
					{#if forecast}
						<td>{pct(forecast[color].rp[row.key])}</td>
					{/if}
				{/each}
			</tr>
		{/each}
		{#if forecast && !result}
			<tr>
				<td class="l">Expected RP</td>
				<td>{fixed(forecast.red.rp.expected, 2)}</td>
				<td>{fixed(forecast.blue.rp.expected, 2)}</td>
			</tr>
		{/if}
	</tbody>
</Table>
