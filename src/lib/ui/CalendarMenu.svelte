<script lang="ts">
	import { page } from '$app/state';

	interface Props {
		path: string;
		filename: string;
		note: string;
		label?: string;
	}

	let { path, filename, note, label = 'Add to calendar' }: Props = $props();

	let menu = $state<HTMLDetailsElement>();

	const feed = $derived(`webcal://${page.url.host}${path}`);
	const google = $derived(
		`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed)}`
	);

	function close() {
		if (menu) menu.open = false;
	}

	$effect(() => {
		const element = menu;
		if (!element) return;
		const outside = (event: Event) => {
			if (element.open && !element.contains(event.target as Node)) close();
		};
		const escape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || !element.open) return;
			close();
			element.querySelector('summary')?.focus();
		};
		document.addEventListener('click', outside);
		document.addEventListener('keydown', escape);
		return () => {
			document.removeEventListener('click', outside);
			document.removeEventListener('keydown', escape);
		};
	});
</script>

<details class="calendar" bind:this={menu}>
	<summary>{label}</summary>
	<div class="panel">
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
	</div>
</details>

<style>
	.calendar {
		position: relative;
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: var(--control-h);
		padding: 8px 12px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		color: var(--text);
		font: 500 13px/1 var(--font);
		white-space: nowrap;
		list-style: none;
		cursor: pointer;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary::after {
		content: '';
		width: 5px;
		height: 5px;
		margin-top: -3px;
		border-right: 1.5px solid var(--text-2);
		border-bottom: 1.5px solid var(--text-2);
		transform: rotate(45deg);
	}

	summary:hover,
	.calendar[open] summary {
		background: var(--surface);
	}

	.panel {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 20;
		width: 290px;
		padding: 12px 0 6px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-panel);
		background: var(--bg);
		box-shadow: var(--shadow-pop);
	}

	.note {
		padding: 0 14px 8px;
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

	@media (max-width: 760px) {
		.panel {
			position: fixed;
			top: auto;
			right: 16px;
			left: 16px;
			width: auto;
			margin-top: 6px;
		}
	}

	@media (pointer: coarse) {
		summary {
			min-height: 40px;
		}

		a {
			padding-block: 11px;
		}
	}
</style>
