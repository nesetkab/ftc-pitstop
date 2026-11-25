<script lang="ts">
	import { page } from '$app/state';
	import Button from '#lib/ui/Button.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { searchDialog } from '#lib/ui/search.svelte.ts';

	const missing = $derived(page.status === 404);
	const title = $derived(
		missing ? page.error?.message || 'Event not found' : 'Event data is unavailable'
	);
	const route = $derived(page.route.id ?? '');
	const meta = $derived(
		!missing
			? 'The event could not be loaded. Try again in a moment.'
			: route.includes('/matches/')
				? 'Check the match number in the address.'
				: route.includes('/teams/')
					? 'This team is not on the list for this event.'
					: 'Check the event code, or search for the event by name.'
	);
</script>

<svelte:head>
	<title>{missing ? 'Not found' : 'Unavailable'} - PitStop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<PageHeader {title} {meta}>
	{#snippet actions()}
		<Button icon="search" onclick={() => (searchDialog.open = true)}>Search teams and events</Button
		>
		<Button variant="secondary" href="/events">Events</Button>
	{/snippet}
</PageHeader>
