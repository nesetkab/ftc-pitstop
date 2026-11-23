<script lang="ts">
	import { onMount } from 'svelte';
	import { follows, readFollows } from '#lib/components/follow/follow.svelte.ts';
	import { SEASON_NAME } from '#lib/seo.ts';
	import { dismissHint, INTRO_HINT, readHints, showIntro } from '#lib/ui/hints.ts';

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
			Live FTC results, rankings and OPR for the {SEASON_NAME} season, plus match-day tools: a pit display
			for your TV, a shared pick list and printable scouting reports.
		</p>
		<ul>
			<li><a href="#pit">Pit display</a></li>
			<li><a href="/w">Team workspace</a></li>
			<li><a href="/advancement">Advancement tracker</a></li>
			<li><a href="/events/strength">Event strength</a></li>
		</ul>
		<button type="button" class="hide" onclick={hide}>Hide</button>
	</section>
{/if}

<style>
	.intro {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 8px 24px;
		max-width: 760px;
	}

	:global(:root[data-returning]) .intro {
		display: none;
	}

	.lead {
		grid-column: 1;
		font-size: 17px;
		line-height: 1.5;
		text-wrap: pretty;
	}

	ul {
		grid-column: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 20px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 14px;
	}

	a {
		font-weight: 500;
		text-underline-offset: 3px;
	}

	.hide {
		grid-column: 2;
		grid-row: 1;
		align-self: start;
		margin-top: 3px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--text-3);
		font: inherit;
		font-size: 13px;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.hide:hover {
		color: var(--text);
	}

	@media (pointer: coarse) {
		a,
		.hide {
			display: inline-block;
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
