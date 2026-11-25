<script lang="ts">
	import { onMount } from 'svelte';
	import { follows, readFollows } from '#lib/components/follow/follow.svelte.ts';
	import { SEASON_NAME } from '#lib/seo.ts';
	import { dismissHint, INTRO_HINT, readHints, showIntro } from '#lib/ui/hints.ts';
	import Icon from '#lib/ui/Icon.svelte';

	let mounted = $state(false);
	let hidden = $state(false);

	const visible = $derived(!mounted || !hidden);

	onMount(() => {
		const followed = readFollows();
		if (followed.length > 0) hide();
		else hidden = !showIntro(readHints(), followed);
		mounted = true;
	});

	$effect(() => {
		if (follows.teams.length > 0) hide();
	});

	function hide() {
		dismissHint(INTRO_HINT);
		hidden = true;
	}
</script>

{#if visible}
	<section class="intro" aria-labelledby="intro-title">
		<h2 class="visually-hidden" id="intro-title">What PitStop does</h2>
		<p class="lead">
			Live FTC results, rankings and OPR for the <span class="season">{SEASON_NAME}</span> season.
		</p>
		<p class="sub">
			Plus a <a href="#pit">pit display</a> for your TV, a shared
			<a href="/w">team workspace</a> with a pick list, an
			<a href="/advancement">advancement tracker</a> and
			<a href="/events/strength">event strength</a> for every event.
		</p>
		<button type="button" class="hide" onclick={hide}><Icon name="close" size={12} />Hide</button>
	</section>
{/if}

<style>
	.intro {
		display: grid;
		justify-items: start;
		align-content: start;
		max-width: 680px;
	}

	:global(:root[data-returning]) .intro {
		display: none;
	}

	.lead {
		font-size: 26px;
		font-weight: 600;
		line-height: 1.22;
		letter-spacing: -0.015em;
		text-wrap: balance;
	}

	.season {
		white-space: nowrap;
	}

	.sub {
		margin-top: 10px;
		font-size: 16px;
		line-height: 1.5;
		color: var(--text-2);
		text-wrap: pretty;
	}

	a {
		color: var(--text);
		text-underline-offset: 3px;
	}

	.hide {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-top: 8px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--text-3);
		font: inherit;
		font-size: 13px;
	}

	.hide:hover {
		color: var(--text);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	@media (max-width: 600px) {
		.lead {
			font-size: 22px;
		}

		.sub {
			font-size: 15px;
		}
	}

	@media (pointer: coarse) {
		.hide {
			margin-block: -10px;
			padding-block: 10px;
			margin-inline: -8px;
			padding-inline: 8px;
		}
	}
</style>
