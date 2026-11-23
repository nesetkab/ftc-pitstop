<script lang="ts">
	import { tick } from 'svelte';
	import '#lib/components/tools/controls.css';
	import Button from '#lib/ui/Button.svelte';
	import type { SearchFn } from '#lib/ui/search.svelte.ts';
	import {
		COLORS,
		colorName,
		SLOT_FIELDS,
		simulateHref,
		swapped,
		withoutTeam,
		type Color,
		type Sides
	} from './simulate.ts';
	import TeamSlot from './TeamSlot.svelte';

	interface Props {
		sides: Sides;
		picked: Record<Color, { number: number; name: string | null }[]>;
		search?: SearchFn;
	}

	let { sides, picked, search }: Props = $props();

	let form = $state<HTMLFormElement>();
	const any = $derived(COLORS.some((color) => sides[color].length > 0));

	async function submit() {
		await tick();
		form?.requestSubmit();
	}
</script>

<form class="picker" method="get" action="/simulate" bind:this={form} aria-label="Pick teams">
	{#each COLORS as color, index (color)}
		{#if index > 0}
			<span class="vs" aria-hidden="true">vs</span>
		{/if}
		<fieldset class={['side', color]}>
			<legend>{colorName(color)} alliance</legend>
			<div class="slots">
				{#each SLOT_FIELDS[color] as field, slot (field)}
					{@const team = picked[color][slot] ?? null}
					<TeamSlot
						{field}
						{color}
						{search}
						label="{colorName(color)} {slot + 1}"
						{team}
						removeHref={team ? simulateHref(withoutTeam(sides, team.number)) : null}
						onpick={submit}
					/>
				{/each}
			</div>
		</fieldset>
	{/each}
	<div class="actions">
		<Button type="submit">Simulate</Button>
		{#if any}
			<Button variant="secondary" href={simulateHref(swapped(sides))} data-sveltekit-noscroll>
				Swap sides
			</Button>
			<a class="clear" href="/simulate">Clear</a>
		{/if}
	</div>
</form>

<style>
	.picker {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		gap: 14px 18px;
		align-items: start;
	}

	.side {
		min-width: 0;
		margin: 0;
		padding: 12px 14px 14px;
		border: 1px solid var(--line);
		border-left-width: 3px;
		border-radius: var(--radius-control);
	}

	.side.red {
		border-left-color: var(--red);
	}

	.side.blue {
		border-left-color: var(--blue);
	}

	legend {
		padding: 0 4px;
		font-size: 14px;
		font-weight: 600;
	}

	.slots {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.vs {
		align-self: center;
		font-size: 13px;
		color: var(--text-3);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		grid-column: 1 / -1;
		align-items: center;
		gap: 10px;
	}

	.clear {
		font-size: 13px;
		color: var(--text-2);
	}

	@media (max-width: 760px) {
		.picker {
			grid-template-columns: minmax(0, 1fr);
		}

		.vs {
			display: none;
		}
	}

	@media (max-width: 340px) {
		.slots {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
