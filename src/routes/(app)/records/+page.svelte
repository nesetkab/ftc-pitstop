<script lang="ts">
	import RecordsPage from '#lib/components/records/RecordsPage.svelte';
	import { SEASON_NAME, siteTitle } from '#lib/seo.ts';
	import Seo from '#lib/ui/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	title={siteTitle(`FTC high scores and season records, ${SEASON_NAME}`)}
	description="The highest FTC alliance scores of the {SEASON_NAME} season, ranked by total, auto, teleop, hive, flower and garden points. Filter by date, region, event type and team."
	path="/records"
/>

<RecordsPage {data} />
