<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '#lib/ui/Button.svelte';

	let value = $state('');

	const team = $derived(/^[1-9]\d{0,5}$/.test(value.trim()) ? value.trim() : null);

	function open(event: SubmitEvent) {
		event.preventDefault();
		if (team) goto(`/${team}/tv`);
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
			<input
				name="team"
				type="text"
				inputmode="numeric"
				autocomplete="off"
				maxlength="6"
				placeholder="Team number"
				aria-label="Team number"
				bind:value
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

	input {
		width: 8.5em;
		padding: 7px 2px;
		border: 0;
		background: transparent;
		font-size: 14px;
		line-height: 1.4;
		font-variant-numeric: tabular-nums;
		outline: none;
	}

	@media (pointer: coarse) {
		input {
			min-height: 38px;
		}
	}

	input::placeholder {
		color: var(--text-3);
	}
</style>
