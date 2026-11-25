<script lang="ts">
	import '#lib/components/tools/controls.css';
	import { sidesFrom, simulateHref } from '#lib/components/simulate/simulate.ts';
	import type { AllianceSelection } from '#lib/types.ts';
	import Button from '#lib/ui/Button.svelte';

	interface Props {
		alliances: Pick<AllianceSelection, 'seed' | 'captain' | 'picks'>[];
	}

	let { alliances }: Props = $props();

	const id = $props.id();
	let red = $state(1);
	let blue = $state(2);

	const members = (seed: number) => {
		const alliance = alliances.find((entry) => entry.seed === seed);
		return alliance ? [alliance.captain, ...alliance.picks] : [];
	};
	const href = $derived(simulateHref(sidesFrom(members(red), red === blue ? [] : members(blue))));
</script>

<div class="sim">
	<div class="row">
		<label class="visually-hidden" for="{id}-red">Red alliance</label>
		<select id="{id}-red" class="ctl-select" bind:value={red}>
			{#each alliances as alliance (alliance.seed)}
				<option value={alliance.seed}>Red: alliance {alliance.seed}</option>
			{/each}
		</select>
		<span class="vs">vs</span>
		<label class="visually-hidden" for="{id}-blue">Blue alliance</label>
		<select id="{id}-blue" class="ctl-select" bind:value={blue}>
			{#each alliances as alliance (alliance.seed)}
				<option value={alliance.seed}>Blue: alliance {alliance.seed}</option>
			{/each}
		</select>
	</div>
	<Button variant="secondary" {href}>Simulate this match</Button>
	<p class="note">Uses each alliance's captain and first pick.</p>
</div>

<style>
	.sim {
		display: grid;
		gap: 8px;
		justify-items: start;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		gap: 6px;
		align-items: center;
		width: 100%;
	}

	.vs {
		font-size: 13px;
		color: var(--text-3);
	}
</style>
