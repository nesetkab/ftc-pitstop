<script lang="ts">
	import RecordsPage from '#lib/components/records/RecordsPage.svelte';
	import { siteTitle } from '#lib/seo.ts';
	import Seo from '#lib/ui/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo title={siteTitle('Season records')} description="Season records" path="/records" noindex />

<RecordsPage {data} swipe />
