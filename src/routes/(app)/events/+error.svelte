<script lang="ts">
	import { page } from '$app/state';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';

	const missing = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{missing ? 'Not found' : 'Unavailable'}</title>
</svelte:head>

<PageHeader title={missing ? page.error?.message || 'Not found' : 'Event data is unavailable'} />

<EmptyState title={missing ? 'Check the event code or match number.' : 'Try again in a minute.'}>
	<a href="/events">See all events</a>
</EmptyState>
