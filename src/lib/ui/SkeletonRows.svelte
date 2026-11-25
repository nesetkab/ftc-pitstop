<script lang="ts">
	import Skeleton from './Skeleton.svelte';

	interface Props {
		label: string;
		rows?: number;
		header?: boolean;
	}

	let { label, rows = 6, header = false }: Props = $props();

	const WIDTHS = ['64%', '48%', '72%', '56%', '68%', '44%'];
</script>

<div class="loading" role="status">
	<span class="visually-hidden">{label}</span>
	{#if header}
		<div class="header">
			<Skeleton width="min(320px, 60%)" height="31px" />
			<Skeleton width="min(220px, 40%)" height="16px" />
		</div>
	{/if}
	<div class="rows">
		{#each { length: rows }, index (index)}
			<div class="row">
				<Skeleton width={WIDTHS[index % WIDTHS.length]} />
				<Skeleton width="36px" />
			</div>
		{/each}
	</div>
</div>

<style>
	.loading,
	.header {
		display: grid;
		gap: 10px;
	}

	.loading {
		--sk-delay: 0s;
		gap: var(--space-stack);
		animation: wait 0.2s 0.15s backwards;
	}

	@keyframes wait {
		from {
			opacity: 0;
		}
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: 20px;
		padding: 12px 0;
		border-bottom: 1px solid var(--line);
	}
</style>
