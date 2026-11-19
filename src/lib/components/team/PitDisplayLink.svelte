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

<form onsubmit={open} aria-labelledby="pit-label">
	<h2 class="sec-title" id="pit-label">Open the pit display for your team</h2>
	<div class="row">
		<div class="address">
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
		</div>
		<Button type="submit" disabled={team === null}>Open</Button>
	</div>
</form>

<style>
	form {
		display: grid;
		gap: 10px;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.address {
		display: inline-flex;
		align-items: baseline;
		padding: 6px 10px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		font-size: 14px;
	}

	.address:focus-within {
		border-color: var(--text-3);
	}

	.host {
		color: var(--text-3);
	}

	input {
		width: 8.5em;
		padding: 0 2px;
		border: 0;
		background: transparent;
		font-size: 14px;
		font-variant-numeric: tabular-nums;
		outline: none;
	}

	input::placeholder {
		color: var(--text-3);
	}
</style>
