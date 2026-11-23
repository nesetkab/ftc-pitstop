<script lang="ts">
	import Term from './Term.svelte';

	let { label }: { label: string } = $props();
</script>

<a href="/sort"><Term {label} nested /></a>
