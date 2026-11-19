<script lang="ts">
	import { fixed, integer, MISSING, record } from '#lib/format/index.ts';
	import type { TeamPageData } from './team-view.ts';

	interface Props {
		stats: TeamPageData['stats'];
	}

	let { stats }: Props = $props();
</script>

<dl class="stats">
	<div>
		<dt>Season OPR</dt>
		<dd>{fixed(stats.opr)}</dd>
	</div>
	<div>
		<dt>World rank by OPR</dt>
		<dd>
			{#if stats.rank !== null && stats.of !== null}
				{integer(stats.rank)} <small>of {integer(stats.of)}</small>
			{:else}
				{MISSING}
			{/if}
		</dd>
	</div>
	<div>
		<dt>Record</dt>
		<dd>
			{stats.record ? record(stats.record.wins, stats.record.losses, stats.record.ties) : MISSING}
		</dd>
	</div>
	<div>
		<dt>Events played</dt>
		<dd>{stats.events}</dd>
	</div>
</dl>

<style>
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 32px;
		margin: 0;
	}

	.stats div {
		display: grid;
		gap: 2px;
	}

	dt {
		font-size: 13px;
		color: var(--text-2);
	}

	dd {
		margin: 0;
		font-size: 22px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	small {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-2);
	}

	@media (max-width: 600px) {
		.stats {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 14px 20px;
		}
	}
</style>
