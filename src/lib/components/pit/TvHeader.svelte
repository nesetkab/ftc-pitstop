<script lang="ts">
	import { time } from '#lib/format/time.ts';
	import Logo from '#lib/ui/Logo.svelte';

	interface Props {
		eventName: string;
		team: number;
		teamName: string | null;
		now: number;
		timeZone: string;
	}

	let { eventName, team, teamName, now, timeZone }: Props = $props();

	let canFullscreen = $state(false);
	let fullscreen = $state(false);

	$effect(() => {
		canFullscreen = document.fullscreenEnabled === true;
		const sync = () => (fullscreen = document.fullscreenElement !== null);
		sync();
		document.addEventListener('fullscreenchange', sync);
		return () => document.removeEventListener('fullscreenchange', sync);
	});

	async function enterFullscreen() {
		try {
			await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
		} catch {
			canFullscreen = false;
		}
	}
</script>

<header class="head">
	<Logo height="0.95em" />
	<span class="event">{eventName}</span>
	<span class="space"></span>
	<h1 class="me">
		{team}{#if teamName}<span class="name">{` ${teamName}`}</span>{/if}
	</h1>
	<time datetime={new Date(now).toISOString()}>{time(now, timeZone)}</time>
	{#if canFullscreen && !fullscreen}
		<button type="button" onclick={enterFullscreen}>Full screen</button>
	{/if}
</header>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 1em;
		min-width: 0;
		padding: 0 1.4em;
		border-bottom: 1px solid var(--line);
		font-size: 0.9em;
		white-space: nowrap;
	}

	.event {
		flex-shrink: 10;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-2);
	}

	.space {
		flex: 1;
	}

	.me {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: inherit;
		font-weight: 600;
		line-height: inherit;
		letter-spacing: inherit;
		white-space: nowrap;
	}

	time {
		font-variant-numeric: tabular-nums;
	}

	@media (orientation: portrait) {
		.name {
			display: none;
		}
	}

	button {
		padding: 0.3em 0.7em;
		border: 1px solid var(--line-2);
		border-radius: 0.3em;
		background: transparent;
		color: var(--text-2);
		font: 500 0.8em/1.2 var(--font);
	}

	button:hover {
		color: var(--text);
		background: var(--surface);
	}
</style>
