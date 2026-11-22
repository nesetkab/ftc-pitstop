<script lang="ts">
	import type { Highlight, HighlightNames, Highlights } from './highlights.ts';

	interface Props {
		highlights: Highlights & { names: HighlightNames };
	}

	let { highlights }: Props = $props();

	const groups = $derived(
		[
			{ id: 'highest', title: 'Highest scores', items: highlights.highest },
			{ id: 'closest', title: 'Closest games', items: highlights.closest },
			{ id: 'upsets', title: 'Upsets', items: highlights.upsets }
		].filter((group) => group.items.length > 0)
	);

	function eventName(item: Highlight): string {
		return highlights.names.events[item.event] ?? item.event;
	}

	function note(id: string, item: Highlight): string {
		if (id === 'upsets' && item.chance !== null) {
			return `Won with a ${Math.max(1, Math.round(item.chance * 100))}% chance`;
		}
		if (id === 'closest') {
			const margin = Math.abs(item.redScore - item.blueScore);
			return margin === 0 ? 'Tie' : `Won by ${margin}`;
		}
		return '';
	}
</script>

<section aria-labelledby="best-title">
	<h2 class="sec-title" id="best-title">
		Best matches {highlights.range === 'today' ? 'today' : 'this week'}
	</h2>
	<div class="groups">
		{#each groups as group (group.id)}
			<div class="group">
				<h3 id="best-{group.id}">{group.title}</h3>
				<ol aria-labelledby="best-{group.id}">
					{#each group.items as item (item.event + item.key)}
						<li>
							<a class="match" href="/events/{item.event}/matches/{item.key}">
								<span class="score">
									<span class={['red', { won: item.winner === 'red' }]}>{item.redScore}</span><span
										class="dash">–</span
									><span class={['blue', { won: item.winner === 'blue' }]}>{item.blueScore}</span>
								</span>
								<span class="where">{item.label} · {eventName(item)}</span>
							</a>
							<span class="teams">
								<span class="red-team">{item.red.join(' ')}</span>
								<span class="faint">vs</span>
								<span class="blue-team">{item.blue.join(' ')}</span>
							</span>
							{#if note(group.id, item)}
								<span class="note">{note(group.id, item)}</span>
							{/if}
						</li>
					{/each}
				</ol>
			</div>
		{/each}
	</div>
	<p class="more">
		<a href="/records?range=7">More records</a>
		<span class="faint">·</span>
		<a href="/compare">Compare teams</a>
	</p>
</section>

<style>
	section {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
	}

	.groups {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
		gap: 16px 24px;
	}

	h3 {
		padding-bottom: 6px;
		border-bottom: 1px solid var(--line-2);
		font-size: 12.5px;
		font-weight: 500;
		color: var(--text-3);
	}

	ol {
		margin: 0;
		padding: 0;
		list-style: none;
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
		color: var(--text-2);
	}

	.score .won {
		font-weight: 600;
		color: var(--text);
	}

	.dash {
		padding-inline: 2px;
		color: var(--text-3);
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

	.note {
		font-size: 12.5px;
	}

	.more {
		font-size: 14px;
	}

	@media (pointer: coarse) {
		.more a {
			display: inline-block;
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
