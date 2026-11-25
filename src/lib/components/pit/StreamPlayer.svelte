<script lang="ts">
	import { page } from '$app/state';
	import { httpUrl } from '#lib/format/url.ts';
	import { streamEmbed } from '#lib/stream.ts';
	import { STREAM_LINK_KEY } from './stream.ts';

	interface Props {
		code: string;
		listed: string | null;
	}

	let { code, listed }: Props = $props();

	let editing = $state(false);
	let draft = $state('');
	let invalid = $state(false);

	const key = $derived(`${STREAM_LINK_KEY}:${code}`);
	const parent = $derived(page.url.hostname);
	let custom = $derived.by(() => {
		try {
			return httpUrl(localStorage.getItem(key));
		} catch {
			return null;
		}
	});
	const link = $derived(custom ?? listed);
	const embed = $derived(streamEmbed(link, parent));
	const showForm = $derived(editing || !embed);

	function store(value: string | null) {
		custom = value;
		try {
			if (value) localStorage.setItem(key, value);
			else localStorage.removeItem(key);
		} catch {
			return;
		}
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const url = httpUrl(draft);
		invalid = url === null;
		if (!url) return;
		store(url === listed ? null : url);
		draft = '';
		editing = false;
	}

	function reset() {
		store(null);
		draft = '';
		invalid = false;
		editing = false;
	}
</script>

<div class="stream">
	<div class="frame">
		{#if embed}
			{#key embed}
				<iframe
					title="Event live stream"
					src={embed}
					allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
					allowfullscreen
					referrerpolicy="strict-origin-when-cross-origin"
				></iframe>
			{/key}
		{:else}
			<div class="empty">
				{#if link}
					<p>This stream can't play here.</p>
					<a href={link} target="_blank" rel="noopener noreferrer">Open the stream</a>
				{:else}
					<p>No stream is listed for this event.</p>
				{/if}
			</div>
		{/if}
	</div>
	{#if showForm}
		<form class="bar" onsubmit={submit}>
			<label class="visually-hidden" for="stream-link-{code}">Stream link</label>
			<input
				id="stream-link-{code}"
				type="url"
				inputmode="url"
				autocomplete="off"
				placeholder="Paste a YouTube or Twitch link"
				bind:value={draft}
				aria-invalid={invalid}
				aria-describedby={invalid ? `stream-error-${code}` : undefined}
			/>
			<button type="submit">Play</button>
			{#if custom}
				<button type="button" onclick={reset}>{listed ? 'Use listed stream' : 'Clear'}</button>
			{:else if editing}
				<button type="button" onclick={() => (editing = false)}>Cancel</button>
			{/if}
		</form>
		{#if invalid}
			<p class="error" id="stream-error-{code}">Paste a full link that starts with https.</p>
		{/if}
	{:else}
		<div class="bar">
			<span class="source">{custom ? 'Your link' : 'Listed for this event'}</span>
			<button type="button" onclick={() => (editing = true)}>Change link</button>
		</div>
	{/if}
</div>

<style>
	.stream {
		display: grid;
		gap: 0.5em;
		min-width: 0;
	}

	.frame {
		aspect-ratio: 16 / 9;
		width: 100%;
		overflow: hidden;
		border-radius: var(--radius-control);
		background: #000;
	}

	iframe {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
	}

	.empty {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.5em;
		height: 100%;
		padding: 1em;
		background: var(--surface);
		color: var(--text-2);
		text-align: center;
	}

	.empty p {
		margin: 0;
	}

	.empty a {
		color: var(--text);
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 0.5em;
		min-width: 0;
	}

	.source {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-size: 0.85em;
		color: var(--text-2);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	input {
		flex: 1;
		min-width: 0;
		min-height: 2.5em;
		padding: 0 0.7em;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-size: 0.9em;
	}

	input[aria-invalid='true'] {
		border-color: var(--text);
	}

	button {
		flex-shrink: 0;
		min-height: 2.5em;
		padding: 0 0.8em;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--text-2);
		font: 500 0.85em/1.2 var(--font);
		white-space: nowrap;
	}

	button:hover {
		color: var(--text);
		background: var(--surface);
	}

	.error {
		margin: 0;
		font-size: 0.85em;
		color: var(--text);
	}
</style>
