<script lang="ts">
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { searchDialog } from '#lib/ui/search.svelte.ts';
</script>

<svelte:head>
	<title>PitStop</title>
</svelte:head>

<PageHeader
	title="PitStop"
	meta="Event stats, match predictions and a pit display for FTC teams in the BIOBUZZ season."
>
	{#snippet actions()}
		<Button onclick={() => (searchDialog.open = true)}>Search teams and events</Button>
	{/snippet}
</PageHeader>

<EmptyState title="Events from today and this week will show here.">
	Your followed teams and their next matches will be listed here too.
</EmptyState>
