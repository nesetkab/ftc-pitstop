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

<PageHeader title={missing ? 'Region not found' : 'Regions are unavailable'} />

<EmptyState
	title={missing ? 'No FTC events this season use that region code.' : 'Try again in a minute.'}
>
	<a href="/regions">See every region</a>
</EmptyState>
