<script lang="ts">
	import Button from '#lib/ui/Button.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
</script>

<svelte:head>
	<title>Records unavailable - PitStop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<PageHeader
	title="Season records are unavailable"
	meta="The records could not be loaded. Try again in a moment."
>
	{#snippet actions()}
		<Button variant="secondary" icon="refresh" href="/records">Try again</Button>
	{/snippet}
</PageHeader>
