<script lang="ts">
	import type { SearchFn } from './search.svelte.ts';
	import type { TeamHit } from './team-lookup.ts';
	import TeamInput from './TeamInput.svelte';

	interface Props {
		search: SearchFn;
		onpick?: (number: number, hit: TeamHit) => void;
		onsubmit?: () => void;
		onchange?: () => void;
	}

	let { search, onpick, onsubmit, onchange }: Props = $props();
	let value = $state('');
</script>

<form
	onsubmit={(event) => {
		event.preventDefault();
		onsubmit?.();
	}}
	{onchange}
>
	<TeamInput label="Team" {search} delay={0} bind:value {onpick} />
	<button type="submit">Go</button>
	<span data-testid="value">{value}</span>
</form>
<button type="button">Outside</button>
