<script lang="ts">
	import Brand from '#lib/ui/Brand.svelte';
	import Score from '#lib/ui/Score.svelte';
	import type { Highlight, HighlightNames, Highlights } from './highlights.ts';

	interface Props {
		highlights: Highlights & { names: HighlightNames };
	}

	let { highlights }: Props = $props();

	function eventName(item: Highlight): string {
		return highlights.names.events[item.event] ?? item.event;
	}
</script>

{#if highlights.highest.length > 0}
	<section aria-labelledby="best-title">
		<div class="head">
			<h2 class="sec-title" id="best-title">
				Highest scores {highlights.range === 'today' ? 'today' : 'this week'}
			</h2>
			<a class="more" href="/records?range=7">More records</a>
		</div>
		<ol aria-labelledby="best-title">
			{#each highlights.highest as item (item.event + item.key)}
				<li>
					<a class="match" href="/events/{item.event}/matches/{item.key}">
						<span class="score">
							<Score left={item.redScore} right={item.blueScore} winner={item.winner} />
						</span>
						<span class="where">{item.label} at <Brand text={eventName(item)} /></span>
					</a>
					<span class="teams">
						<span class="red-team">{item.red.join(' ')}</span>
						<span class="faint">vs</span>
						<span class="blue-team">{item.blue.join(' ')}</span>
					</span>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	section {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
	}

	ol {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
		column-gap: 24px;
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--line-2);
	}

	li {
		display: grid;
		gap: 1px;
		padding: 9px 0;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	.match {
		display: flex;
		align-items: baseline;
		gap: 10px;
		min-width: 0;
		text-decoration: none;
	}

	.match:hover .where {
		text-decoration: underline;
	}

	.score {
		flex: none;
		font-size: 15px;
	}

	.where {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-2);
	}

	.teams {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 13px;
	}

	.red-team {
		color: var(--red);
	}

	.blue-team {
		color: var(--blue);
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 16px;
	}

	.more {
		font-size: 14px;
		color: var(--text-2);
	}

	.more:hover {
		color: var(--text);
	}

	@media (pointer: coarse) {
		li {
			position: relative;
		}

		.match::after {
			content: '';
			position: absolute;
			inset: 0;
		}

		.more {
			display: inline-block;
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
