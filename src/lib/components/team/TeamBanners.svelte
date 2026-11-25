<script lang="ts">
	import Brand from '#lib/ui/Brand.svelte';
	import type { TeamBanner } from './team-view.ts';

	interface Props {
		banners: TeamBanner[];
	}

	let { banners }: Props = $props();
</script>

<ul class="banners" aria-label="Banners">
	{#each banners as banner, index (index)}
		<li>
			<svelte:element
				this={banner.code ? 'a' : 'div'}
				class="banner"
				href={banner.code ? `/events/${banner.code}` : undefined}
			>
				<span class="season">{banner.season}</span>
				<span class="award">{banner.award}</span>
				<span class="event"><Brand text={banner.event} /></span>
			</svelte:element>
		</li>
	{/each}
</ul>

<style>
	.banners {
		--banner: #bf4f00;
		--banner-hover: #a84500;
		--notch: 18px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		width: 136px;
		filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.22));
	}

	.banner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		box-sizing: border-box;
		height: 100%;
		min-height: 184px;
		padding: 18px 10px calc(var(--notch) + 16px);
		color: #ffffff;
		text-align: center;
		text-decoration: none;
		text-transform: uppercase;
		background: var(--banner);
		clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - var(--notch)), 0 100%);
	}

	a.banner:hover {
		background: var(--banner-hover);
	}

	li:has(a:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}

	a.banner:focus-visible {
		outline: none;
	}

	.season {
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.04em;
		font-variant-numeric: tabular-nums;
	}

	.award {
		font-size: 15px;
		font-weight: 700;
		font-style: italic;
		line-height: 1.2;
	}

	.event {
		font-size: 12px;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	@media (max-width: 600px) {
		.banners {
			gap: 6px;
		}

		li {
			width: 116px;
		}

		.banner {
			min-height: 168px;
			padding-inline: 8px;
		}
	}
</style>
