<script lang="ts">
	import { page } from '$app/state';
	import Button from '#lib/ui/Button.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { searchDialog } from '#lib/ui/search.svelte.ts';

	const missing = $derived(page.status === 404);
	const title = $derived(missing ? 'Page not found' : 'Something went wrong');
	const meta = $derived(
		missing
			? 'There is no page at this address. Check the link or search for a team or event.'
			: 'The page could not be loaded. Try again in a moment.'
	);
</script>

<svelte:head>
	<title>{title} - PitStop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<PageHeader {title} {meta}>
	{#snippet actions()}
		<Button icon="search" onclick={() => (searchDialog.open = true)}>Search teams and events</Button
		>
		<Button variant="secondary" href="/events">Events</Button>
	{/snippet}
</PageHeader>
