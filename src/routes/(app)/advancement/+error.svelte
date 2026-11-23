<script lang="ts">
	import { page } from '$app/state';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';

	const missing = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{missing ? 'Not found' : 'Unavailable'} - PitStop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<PageHeader title={missing ? page.error?.message || 'Not found' : 'Advancement is unavailable'} />

<EmptyState
	title={missing
		? 'No championship with that code has teams or qualifiers listed.'
		: 'Try again in a minute.'}
>
	<a href="/advancement">See all championships</a>
</EmptyState>
