<script lang="ts">
	import { page } from '$app/state';
	import Button from '#lib/ui/Button.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { searchDialog } from '#lib/ui/search.svelte.ts';

	const missing = $derived(page.status === 404);
	const title = $derived(
		missing ? page.error?.message || 'Event not found' : 'Event data is unavailable'
	);
	const meta = $derived(
		missing
			? 'Check the event code or match number, or search by name.'
			: 'The event could not be loaded. Try again in a moment.'
	);
</script>

<svelte:head>
	<title>{missing ? 'Not found' : 'Unavailable'} - PitStop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<PageHeader {title} {meta}>
	{#snippet actions()}
		<Button onclick={() => (searchDialog.open = true)}>Search teams and events</Button>
		<Button variant="secondary" href="/events">Events</Button>
	{/snippet}
</PageHeader>
