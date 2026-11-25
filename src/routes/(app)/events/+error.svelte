<script lang="ts">
	import { page } from '$app/state';
	import Button from '#lib/ui/Button.svelte';
	import { missingEvent } from '#lib/ui/not-found.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { searchDialog } from '#lib/ui/search.svelte.ts';

	const missing = $derived(page.status === 404);
	const found = $derived(missingEvent(page.route.id ?? '', page.params));
	const title = $derived(missing ? found.title : 'Event data is unavailable');
	const meta = $derived(missing ? found.meta : 'Try again in a moment.');
	const back = $derived(missing ? found.back : null);
</script>

<svelte:head>
	<title>{missing ? 'Not found' : 'Unavailable'} - PitStop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<PageHeader {title} {meta}>
	{#snippet actions()}
		{#if back}
			<Button href={back.href}>{back.label}</Button>
			<Button variant="secondary" icon="search" onclick={() => (searchDialog.open = true)}>
				Search
			</Button>
		{:else}
			<Button icon="search" onclick={() => (searchDialog.open = true)}>
				Search teams and events
			</Button>
			<Button variant="secondary" href="/events">Events</Button>
		{/if}
	{/snippet}
</PageHeader>
