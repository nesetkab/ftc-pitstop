<script lang="ts">
	import { page } from '$app/state';
	import { getEventView } from '#lib/components/event/context.ts';
	import TeamReport from '#lib/components/event/TeamReport.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const event = $derived(data.bundle.event);
	const params = $derived(page.url.searchParams);
	const sort = $derived(params.get('sort') === 'rank' ? 'rank' : 'team');
	const per = $derived(params.get('per') === '1' ? '1' : '2');

	function query(next: { sort?: string; per?: string }): string {
		const chosen = { sort, per, ...next };
		const parts = [
			...(chosen.sort === 'rank' ? ['sort=rank'] : []),
			...(chosen.per === '1' ? ['per=1'] : [])
		];
		return parts.length > 0 ? `?${parts.join('&')}` : page.url.pathname;
	}

	const reports = $derived(
		sort === 'rank'
			? [...data.reports].sort(
					(a, b) => (a.ranking?.rank ?? Infinity) - (b.ranking?.rank ?? Infinity) || a.team - b.team
				)
			: [...data.reports].sort((a, b) => a.team - b.team)
	);
</script>

{#if reports.length === 0}
	<p class="muted">No teams have registered yet.</p>
{:else}
	<div class="bar">
		<p class="lead">
			One report per team. Prints {per === '1' ? 'one team' : 'two teams'} per page with room for notes.
		</p>
		<div class="controls">
			<Segmented
				label="Order"
				value={sort}
				options={[
					{ value: 'team', label: 'By number', href: query({ sort: 'team' }) },
					{ value: 'rank', label: 'By rank', href: query({ sort: 'rank' }) }
				]}
			/>
			<Segmented
				label="Teams per page"
				value={per}
				options={[
					{ value: '2', label: 'Two per page', href: query({ per: '2' }) },
					{ value: '1', label: 'One per page', href: query({ per: '1' }) }
				]}
			/>
			<Button icon="print" onclick={() => window.print()}>Print</Button>
		</div>
	</div>

	<div class={['sheets', per === '1' ? 'one' : 'two']}>
		{#each reports as report (report.team)}
			<div class="sheet">
				<p class="event">{event.name}</p>
				<TeamReport
					{report}
					code={event.code}
					timeZone={event.timezone}
					followed={view.followed}
					compact={per === '2'}
				/>
			</div>
		{/each}
	</div>
{/if}

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 20px;
	}

	.lead {
		font-size: 14px;
		color: var(--text-2);
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
	}

	.sheets {
		display: grid;
	}

	.sheet {
		padding: 24px 0;
		border-top: 1px solid var(--line);
	}

	.sheet:first-child {
		padding-top: 4px;
		border-top: 0;
	}

	.event {
		display: none;
	}

	@media print {
		.bar,
		:global(main:has(.sheets) .page-header) {
			display: none;
		}

		.event {
			display: block;
			margin-bottom: 2px;
			font-size: 9.5px;
			color: var(--text-3);
		}

		.sheet,
		.sheet:first-child {
			padding: 0;
			border-top: 0;
			break-inside: avoid;
		}

		.one .sheet:not(:last-child) {
			break-after: page;
		}

		.two .sheet:nth-child(odd) {
			padding-bottom: 4mm;
			border-bottom: 1px dashed var(--line-2);
			margin-bottom: 4mm;
		}

		.two .sheet:nth-child(even):not(:last-child) {
			break-after: page;
		}
	}
</style>
