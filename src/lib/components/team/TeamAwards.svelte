<script lang="ts">
	import Brand from '#lib/ui/Brand.svelte';
	import Button from '#lib/ui/Button.svelte';
	import type { TeamAwardSeason } from './team-view.ts';

	interface Props {
		seasons: TeamAwardSeason[];
		limit?: number;
	}

	let { seasons, limit = 12 }: Props = $props();

	let expanded = $state(false);

	const banners = $derived(
		seasons.flatMap((entry) =>
			entry.rows.map((row) => ({
				...row,
				year: `${entry.season}-${String((entry.season + 1) % 100).padStart(2, '0')}`,
				game: entry.game
			}))
		)
	);
	const shown = $derived(expanded ? banners : banners.slice(0, limit));
</script>

<ul class="banners">
	{#each shown as banner, index (index)}
		<li class={['banner', banner.win && 'win']}>
			<span class="name"><Brand text={banner.name} /></span>
			<span class="event">
				{#if banner.code}<a href="/events/{banner.code}">{banner.event}</a
					>{:else}{banner.event}{/if}
			</span>
			<span class="season">
				<span class="year">{banner.year}</span>
				{#if banner.game}<span class="game">{banner.game}</span>{/if}
			</span>
		</li>
	{/each}
</ul>

{#if banners.length > limit}
	<div class="more">
		<Button variant="secondary" aria-expanded={expanded} onclick={() => (expanded = !expanded)}>
			{expanded ? 'Show fewer' : `Show all ${banners.length}`}
		</Button>
	</div>
{/if}

<style>
	.banners {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.banner {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 176px;
		padding: 16px 12px 34px;
		text-align: center;
		background: var(--surface);
		clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 18px), 0 100%);
	}

	.banner.win {
		background: var(--accent-wash);
	}

	.name {
		font-size: 14px;
		font-weight: 600;
		line-height: 1.3;
		color: var(--text);
		overflow-wrap: anywhere;
	}

	.event {
		font-size: 12px;
		line-height: 1.35;
		color: var(--text-2);
		overflow-wrap: anywhere;
	}

	.event a {
		color: inherit;
	}

	.event a:hover {
		color: var(--text);
	}

	.season {
		display: grid;
		gap: 2px;
		margin-top: auto;
		padding-top: 10px;
		font-size: 12px;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	.year {
		font-weight: 600;
		color: var(--text);
	}

	.more {
		display: flex;
		justify-content: center;
	}

	@media (max-width: 600px) {
		.banners {
			grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
			gap: 10px;
		}

		.banner {
			min-height: 160px;
		}
	}
</style>
