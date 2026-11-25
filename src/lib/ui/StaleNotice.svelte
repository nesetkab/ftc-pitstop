<script lang="ts">
	import { relative, secondsBetween } from '#lib/format/relative.ts';
	import { timeWithSeconds, toDate, type DateInput } from '#lib/format/time.ts';

	interface Props {
		updated: DateInput | null | undefined;
		staleAfter?: number;
		prefix?: string;
		timeZone?: string;
	}

	let { updated, staleAfter = 120, prefix = 'Updated', timeZone }: Props = $props();

	let now = $state(Date.now());

	const date = $derived(updated == null ? null : toDate(updated));
	const seen = $derived(date && !Number.isNaN(date.getTime()) ? date : null);

	$effect(() => {
		const from = seen?.getTime() ?? null;
		const fast = Math.max(60, staleAfter);
		let timer: ReturnType<typeof setTimeout>;
		const tick = () => {
			const at = Date.now();
			now = at;
			const seconds = from === null ? 0 : (at - from) / 1000;
			const delay = seconds <= fast ? 1000 : seconds < 3600 ? 15_000 : 60_000;
			timer = setTimeout(tick, delay);
		};
		tick();
		return () => clearTimeout(timer);
	});
	const age = $derived(seen ? Math.max(0, secondsBetween(seen, now)) : 0);
	const stale = $derived(seen !== null && age > staleAfter);
</script>

{#if seen}
	<time
		class={['stale-notice', { stale }]}
		datetime={seen.toISOString()}
		title={timeWithSeconds(seen, timeZone)}
	>
		{prefix}
		{relative(now - age * 1000, now)}
	</time>
{/if}

<style>
	.stale-notice {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.stale {
		margin-inline: -4px;
		padding: 1px 4px;
		border-radius: var(--radius-chip);
		background: var(--surface);
		color: var(--text);
	}
</style>
