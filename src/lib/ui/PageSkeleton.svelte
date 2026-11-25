<script lang="ts" module>
	type Kind = 'tab' | 'event' | 'team' | 'list' | 'compare' | 'simulate' | 'home' | 'page';

	const KINDS: [RegExp, Kind][] = [
		[/^\/\(app\)\/events\/\[code\]\/matches\//, 'page'],
		[/^\/\(app\)\/events\/\[code\]/, 'event'],
		[/^\/\(app\)\/teams\/\[number\]$/, 'team'],
		[/^\/\(app\)\/compare$/, 'compare'],
		[/^\/\(app\)\/simulate$/, 'simulate'],
		[/^\/\(app\)$/, 'home'],
		[/^\/\(app\)\/(leaderboards|records|events|regions|advancement)\b/, 'list']
	];
</script>

<script lang="ts">
	import Skeleton from './Skeleton.svelte';

	let { route, tab }: { route: string | null; tab: boolean } = $props();

	const kind = $derived(
		tab ? 'tab' : (KINDS.find(([pattern]) => pattern.test(route ?? ''))?.[1] ?? 'page')
	);

	const ROW_WIDTHS = ['62%', '48%', '70%', '55%', '66%', '44%', '58%', '68%'];
</script>

{#snippet header(meta = true)}
	<div class="header">
		<Skeleton width="min(420px, 70%)" height="31px" />
		{#if meta}<Skeleton width="min(300px, 50%)" height="16px" />{/if}
	</div>
{/snippet}

{#snippet rows(count: number, numbers = 4)}
	<div class="rows">
		<div class="row head">
			<Skeleton width="24px" height="10px" />
			<Skeleton width="60px" height="10px" />
			<span class="nums">
				{#each { length: numbers }, index (index)}
					<Skeleton width="36px" height="10px" />
				{/each}
			</span>
		</div>
		{#each { length: count }, index (index)}
			<div class="row">
				<Skeleton width="24px" />
				<span class="name"><Skeleton width={ROW_WIDTHS[index % ROW_WIDTHS.length]} /></span>
				<span class="nums">
					{#each { length: numbers }, cell (cell)}
						<Skeleton width="36px" />
					{/each}
				</span>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet controls(count: number)}
	<div class="controls">
		{#each { length: count }, index (index)}
			<Skeleton width={index === 0 ? '220px' : '140px'} height="36px" radius="6px" />
		{/each}
	</div>
{/snippet}

<div class={['skel', { tab }]} style:--sk-delay="0s" aria-hidden="true">
	{#if kind === 'tab'}
		{@render rows(12)}
	{:else if kind === 'event'}
		<Skeleton width="80px" height="14px" />
		{@render header()}
		<Skeleton width="min(360px, 60%)" height="20px" />
		<div class="tabs">
			{#each { length: 7 }, index (index)}
				<Skeleton width="64px" height="14px" />
			{/each}
		</div>
		{@render rows(12)}
	{:else if kind === 'team'}
		{@render header()}
		<div class="stats">
			{#each { length: 4 }, index (index)}
				<div class="stat">
					<Skeleton width={index === 0 ? '84px' : '64px'} height={index === 0 ? '44px' : '22px'} />
					<Skeleton width="90px" height="12px" />
				</div>
			{/each}
		</div>
		<Skeleton width="120px" height="16px" />
		<Skeleton height="200px" radius="8px" />
		{@render rows(4, 5)}
	{:else if kind === 'list'}
		{@render header()}
		{@render controls(5)}
		{@render rows(14, 5)}
	{:else if kind === 'compare'}
		{@render header()}
		{@render controls(3)}
		{@render rows(10, 2)}
	{:else if kind === 'simulate'}
		{@render header()}
		<div class="sides">
			<Skeleton height="96px" radius="8px" />
			<Skeleton height="96px" radius="8px" />
		</div>
		<Skeleton width="96px" height="36px" radius="6px" />
		<Skeleton height="120px" radius="8px" />
	{:else if kind === 'home'}
		<div class="sides">
			<div class="lines">
				<Skeleton width="80%" height="24px" />
				<Skeleton width="60%" height="24px" />
				<Skeleton width="90%" />
				<Skeleton width="70%" />
			</div>
			<div class="lines">
				<Skeleton width="120px" height="16px" />
				<Skeleton width="70%" />
				<Skeleton width="100%" height="36px" radius="6px" />
			</div>
		</div>
		<Skeleton width="140px" height="16px" />
		<Skeleton height="64px" radius="8px" />
		{@render rows(6, 3)}
	{:else}
		{@render header()}
		<div class="lines">
			<Skeleton width="92%" />
			<Skeleton width="84%" />
			<Skeleton width="60%" />
		</div>
		{@render rows(8, 3)}
	{/if}
</div>

<style>
	:global(#main:has(> .skel:not(.tab)) > :not(.skel)),
	:global(#main:has(> .skel.tab) > .tab-row ~ :not(.skel)) {
		display: none;
	}

	.skel {
		order: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--space-stack);
		min-height: 60vh;
	}

	.header,
	.lines,
	.stat {
		display: grid;
		gap: 10px;
	}

	.controls,
	.tabs,
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.tabs {
		gap: 22px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--line);
	}

	.stats {
		align-items: end;
		gap: 40px;
	}

	.sides {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
		gap: var(--space-columns);
	}

	.rows {
		display: grid;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 13px 10px;
		border-bottom: 1px solid var(--line);
	}

	.row.head {
		padding-block: 0 10px;
		border-color: var(--line-2);
	}

	.name {
		flex: 1;
		min-width: 0;
	}

	.nums {
		display: flex;
		gap: 28px;
	}

	@media (max-width: 600px) {
		.nums > :global(:nth-child(n + 3)) {
			display: none;
		}

		.controls > :global(:nth-child(n + 2)) {
			flex: 1 1 120px;
		}

		.controls > :global(:first-child) {
			flex-basis: 100%;
		}

		.stats {
			gap: 24px;
		}
	}
</style>
