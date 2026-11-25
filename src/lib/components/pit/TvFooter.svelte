<script lang="ts">
	import { relative } from '#lib/format/relative.ts';
	import type { DataSource } from '#lib/types.ts';
	import { updatedClock } from './copy.ts';
	import type { Connection } from './poll.ts';

	interface Props {
		connection: Connection;
		updated: number | null;
		source: DataSource;
		stale: boolean;
		now: number;
		timeZone: string;
		onField: string | null;
		upNext: string | null;
		replaySpeed?: number | null;
	}

	let {
		connection,
		updated,
		source,
		stale,
		now,
		timeZone,
		onField,
		upNext,
		replaySpeed = null
	}: Props = $props();

	const STATE: Record<Connection, string> = {
		connected: 'Connected',
		retrying: 'Reconnecting',
		offline: 'Offline'
	};

	const from = $derived(source === 'ftc' ? 'FTC Events' : 'FTCScout');
</script>

<footer class={['foot', { stale }]}>
	<span class="state"><span class={['dot', connection]}></span>{STATE[connection]}</span>
	{#if updated !== null}
		<span class="updated">
			Updated {updatedClock(updated, now, timeZone)} from {from}{stale || connection === 'offline'
				? `, ${relative(updated, now)}`
				: ''}
		</span>
	{/if}
	<span class="space"></span>
	{#if replaySpeed !== null}
		<span>Replay{replaySpeed === 1 ? '' : ` at ${replaySpeed}× speed`}</span>
	{/if}
	{#if onField}
		<span>{onField} is on the field</span>
	{:else if upNext}
		<span>{upNext} is next</span>
	{/if}
</footer>

<style>
	.foot {
		display: flex;
		align-items: center;
		gap: 1.6em;
		min-width: 0;
		padding: 0 1.4em;
		border-top: 1px solid var(--line);
		font-size: 0.72em;
		color: var(--text-2);
		white-space: nowrap;
		transition:
			background-color 400ms ease-out,
			color 400ms ease-out;
	}

	.stale {
		background: var(--text);
		color: var(--bg);
		font-weight: 500;
	}

	.foot > span {
		flex: none;
	}

	.foot > .updated {
		flex: 0 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.state {
		display: inline-flex;
		align-items: center;
	}

	.dot {
		display: inline-block;
		width: 0.6em;
		height: 0.6em;
		margin-right: 0.45em;
		border-radius: 50%;
		background: var(--ok);
		transition:
			background-color 400ms ease-out,
			box-shadow 400ms ease-out;
	}

	.dot.retrying {
		background: transparent;
		box-shadow: inset 0 0 0 0.14em var(--text-2);
	}

	.dot.offline {
		background: var(--text-3);
	}

	.stale .dot {
		background: var(--bg);
		box-shadow: none;
	}

	.foot > .space {
		flex: 1 1 0;
	}
</style>
