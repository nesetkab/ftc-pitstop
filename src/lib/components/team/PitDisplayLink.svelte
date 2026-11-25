<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '#lib/ui/Button.svelte';
	import type { SearchFn } from '#lib/ui/search.svelte.ts';
	import TeamInput from '#lib/ui/TeamInput.svelte';

	interface Props {
		search?: SearchFn;
		delay?: number;
	}

	let { search, delay }: Props = $props();

	let value = $state('');

	const team = $derived(/^[1-9]\d{0,5}$/.test(value.trim()) ? value.trim() : null);

	function open(event: SubmitEvent) {
		event.preventDefault();
		if (team) goto(`/${team}/tv`);
	}

	function pick(number: number) {
		goto(`/${number}/tv`);
	}
</script>

<form id="pit" onsubmit={open} aria-labelledby="pit-label">
	<h2 class="sec-title" id="pit-label">Pit display</h2>
	<p class="about">
		Your next match, queue time and rank on the TV in your pit, updated live. Leave off /tv for the
		phone version.
	</p>
	<div class="row">
		<label class="address">
			<span class="host">ftcpitstop.com/</span>
			<TeamInput
				name="team"
				class="field"
				label="Team number or name"
				placeholder="Number or name"
				enterkeyhint="go"
				{search}
				{delay}
				bind:value
				onpick={pick}
			/>
			<span class="host">/tv</span>
		</label>
		<Button type="submit" disabled={team === null}>Open</Button>
	</div>
</form>

<style>
	form {
		display: grid;
		gap: 10px;
	}

	#pit {
		scroll-margin-top: 24px;
	}

	.about {
		max-width: 620px;
		font-size: 14px;
		color: var(--text-2);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.address {
		position: relative;
		display: inline-flex;
		align-items: center;
		padding: 0 10px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		font-size: 14px;
		line-height: 1.4;
		cursor: text;
	}

	.address:hover {
		border-color: var(--text-3);
	}

	.address:focus-within {
		border-color: var(--text-3);
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}

	.host {
		color: var(--text-3);
	}

	.address :global(.team-input) {
		position: static;
		flex: 0 1 auto;
	}

	.address :global(.field) {
		width: 8.5em;
		min-width: 0;
		padding: 7px 2px;
		border: 0;
		background: transparent;
		font-size: 14px;
		line-height: 1.4;
		font-variant-numeric: tabular-nums;
		outline: none;
	}

	@media (pointer: coarse) {
		.address :global(.field) {
			min-height: 38px;
		}
	}

	.address :global(.field::placeholder) {
		color: var(--text-3);
	}
	@media (pointer: coarse), (max-width: 600px) {
		.address,
		.address :global(.field) {
			font-size: 16px;
		}
	}
</style>
