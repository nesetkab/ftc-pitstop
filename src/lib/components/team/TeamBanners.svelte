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
				<svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
					<circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="4" />
					<circle
						cx="16"
						cy="16"
						r="13.5"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-dasharray="5.3 5.3"
					/>
				</svg>
				<span class="award">{banner.award}</span>
				<span class="event">{banner.season} <Brand text={banner.event} /></span>
			</svelte:element>
		</li>
	{/each}
</ul>

<style>
	.banners {
		--banner: #bf4f00;
		--banner-hover: #a84500;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		container-type: inline-size;
		width: 150px;
		filter: drop-shadow(0 4px 4px rgb(0 0 0 / 0.25));
	}

	.banner {
		display: flex;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
		aspect-ratio: 320 / 445;
		padding: 12.5cqw 6cqw 0;
		color: #ffffff;
		text-align: center;
		text-decoration: none;
		text-transform: uppercase;
		background: var(--banner);
		clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 90%, 0 100%);
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

	.mark {
		flex: none;
		width: 31cqw;
		height: 31cqw;
	}

	.award {
		margin-top: 17.5cqw;
		font-size: 9cqw;
		font-weight: 700;
		font-style: italic;
		line-height: 1.1;
	}

	.event {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		margin-bottom: 12cqw;
		font-size: 7.5cqw;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}
</style>
