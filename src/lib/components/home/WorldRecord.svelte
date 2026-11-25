<script lang="ts">
	import { shortDate } from '#lib/format/index.ts';
	import type { HighlightNames } from './highlights.ts';
	import type { WorldRecord } from './record.ts';

	interface Props {
		record: WorldRecord & { names: HighlightNames };
	}

	let { record }: Props = $props();

	const own = $derived(record.alliance === 'red' ? record.red : record.blue);
	const opponents = $derived(record.alliance === 'red' ? record.blue : record.red);
	const score = $derived(record.alliance === 'red' ? record.redScore : record.blueScore);
	const opponentScore = $derived(record.alliance === 'red' ? record.blueScore : record.redScore);
	const side = $derived(record.alliance === 'red' ? 'Red' : 'Blue');
	const eventName = $derived(record.names.events[record.event] ?? record.event);
</script>

<section aria-labelledby="record-title">
	<div class="head">
		<h2 class="sec-title" id="record-title">World record</h2>
		<a class="more" href="/records">All records</a>
	</div>
	<div class="body">
		<a class="score" href="/events/{record.event}/matches/{record.key}">{score}</a>
		<div class="facts">
			<span class="teams">
				{#each own as team (team)}
					<a href="/teams/{team}"
						><b class={record.alliance}>{team}</b>
						{#if record.names.teams[team]}{record.names.teams[team]}{/if}</a
					>
				{/each}
			</span>
			<span class="where">
				<a href="/events/{record.event}/matches/{record.key}">{record.label} {side}</a>
				at <a href="/events/{record.event}">{eventName}</a>, {shortDate(record.day)}
			</span>
			<span class="note">
				Against {opponents.join(' ')}, who scored {opponentScore}. Foul points left out.
				{#if record.ties > 0}
					Tied by {record.ties} other {record.ties === 1 ? 'alliance' : 'alliances'}.
				{/if}
			</span>
		</div>
	</div>
</section>

<style>
	section {
		display: grid;
		gap: 10px;
		align-content: start;
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

	.body {
		display: flex;
		align-items: baseline;
		gap: 14px;
		padding-top: 8px;
		border-top: 1px solid var(--line-2);
		font-variant-numeric: tabular-nums;
	}

	.score {
		flex: none;
		font-size: 24px;
		font-weight: 600;
		line-height: 1.2;
		text-decoration: none;
	}

	.score:hover {
		text-decoration: underline;
	}

	.facts {
		display: grid;
		gap: 2px;
		min-width: 0;
		font-size: 14px;
	}

	.teams {
		display: flex;
		flex-wrap: wrap;
		gap: 0 12px;
	}

	.teams a {
		text-decoration: none;
	}

	.teams a:hover {
		text-decoration: underline;
	}

	.teams b {
		font-weight: 600;
	}

	.red {
		color: var(--red);
	}

	.blue {
		color: var(--blue);
	}

	.where {
		color: var(--text-2);
	}

	.where a {
		color: inherit;
	}

	.where a:hover {
		color: var(--text);
	}

	.note {
		font-size: 12.5px;
	}

	@media (pointer: coarse) {
		.more {
			display: inline-block;
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
