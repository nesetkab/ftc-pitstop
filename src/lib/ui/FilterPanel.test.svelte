<script lang="ts">
	import FilterPanel from './FilterPanel.svelte';

	let { summary = [] }: { summary?: string[] } = $props();
</script>

<FilterPanel {summary}>
	<label>Region <select><option>All regions</option></select></label>
</FilterPanel>
<button type="button">Outside</button>
