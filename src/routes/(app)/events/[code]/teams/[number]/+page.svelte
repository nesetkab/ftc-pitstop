<script lang="ts">
	import { getEventView } from '#lib/components/event/context.ts';
	import TeamReport from '#lib/components/event/TeamReport.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const event = $derived(data.bundle.event);
</script>

<p class="back"><a href="/events/{event.code}/teams">All teams at this event</a></p>

<TeamReport
	report={data.report}
	code={event.code}
	timeZone={event.timezone}
	followed={view.followed}
/>

<p class="more">
	<a href="/events/{event.code}/scouting">Print reports for every team</a>
</p>

<style>
	.back {
		margin-bottom: -8px;
		font-size: 14px;
		color: var(--text-2);
	}

	.back a {
		text-decoration: none;
	}

	.back a:hover {
		color: var(--text);
		text-decoration: underline;
	}

	.more {
		font-size: 14px;
	}

	@media (pointer: coarse) {
		.more a {
			display: inline-block;
			margin-block: -10px;
			padding-block: 10px;
		}
	}

	@media print {
		.back,
		.more {
			display: none;
		}
	}
</style>
