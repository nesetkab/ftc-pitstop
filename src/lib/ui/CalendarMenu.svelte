<script lang="ts">
	import { page } from '$app/state';
	import Menu from './Menu.svelte';

	interface Props {
		path: string;
		filename: string;
		note: string;
		label?: string;
	}

	let { path, filename, note, label = 'Add to calendar' }: Props = $props();

	const feed = $derived(`webcal://${page.url.host}${path}`);
	const google = $derived(
		`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed)}`
	);
</script>

<Menu {label}>
	{#snippet children(close)}
		<p class="note">{note}</p>
		<ul>
			<li><a href={feed} onclick={close}>Subscribe in Apple Calendar or Outlook</a></li>
			<li>
				<a href={google} target="_blank" rel="noopener noreferrer" onclick={close}>
					Subscribe in Google Calendar
				</a>
			</li>
			<li><a href={path} download={filename} onclick={close}>Download .ics file</a></li>
		</ul>
	{/snippet}
</Menu>

<style>
	.note {
		padding: 6px 14px 8px;
		border-bottom: 1px solid var(--line);
		color: var(--text-2);
		font-size: 13px;
		line-height: 1.45;
	}

	ul {
		margin: 0;
		padding: 4px 0 0;
		list-style: none;
	}

	a {
		display: block;
		padding: 8px 14px;
		color: var(--text);
		font-size: 14px;
		text-decoration: none;
	}

	a:hover {
		background: var(--surface);
	}

	@media (pointer: coarse) {
		a {
			padding-block: 11px;
		}
	}
</style>
