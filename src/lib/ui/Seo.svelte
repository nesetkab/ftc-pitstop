<script lang="ts">
	import { page } from '$app/state';
	import { jsonLdScript, type JsonLd } from '#lib/seo.ts';

	interface Props {
		title: string;
		description?: string;
		path?: string;
		data?: JsonLd[];
		noindex?: boolean;
	}

	let { title, description, path, data = [], noindex = false }: Props = $props();

	const canonical = $derived(`${page.url.origin}${path ?? page.url.pathname}`);
	const scripts = $derived(data.map(jsonLdScript).join(''));
</script>

<svelte:head>
	<title>{title}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}
	{#if noindex}
		<meta name="robots" content="noindex" />
	{:else}
		<link rel="canonical" href={canonical} />
	{/if}
	{@html scripts}
</svelte:head>
