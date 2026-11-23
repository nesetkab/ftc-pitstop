<script lang="ts">
	import { page } from '$app/state';
	import '#lib/components/tools/controls.css';
	import {
		BADGE_KINDS,
		badgePath,
		badgeSnippets,
		type BadgeKind,
		type BadgeSnippets
	} from '#lib/badge/links.ts';

	interface Props {
		number: number;
		name: string;
	}

	let { number, name }: Props = $props();

	const FORMATS: { key: keyof BadgeSnippets; label: string }[] = [
		{ key: 'markdown', label: 'Markdown' },
		{ key: 'html', label: 'HTML' },
		{ key: 'url', label: 'Image URL' }
	];

	const selectId = $props.id();

	let kind = $state<BadgeKind>('summary');
	let copied = $state<keyof BadgeSnippets | null>(null);
	let manual = $state<keyof BadgeSnippets | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const kindLabel = $derived(BADGE_KINDS.find((entry) => entry.kind === kind)?.label ?? '');
	const alt = $derived(
		kind === 'summary' || kind === 'card'
			? `FTC team ${number} ${name} on PitStop`
			: `FTC team ${number} ${kindLabel.toLowerCase()} on PitStop`
	);
	const snippets = $derived(badgeSnippets(page.url.origin, number, kind, alt));
	const codes: Partial<Record<keyof BadgeSnippets, HTMLElement>> = {};

	function selectCode(key: keyof BadgeSnippets) {
		const element = codes[key];
		const selection = window.getSelection();
		if (!element || !selection) return;
		const range = document.createRange();
		range.selectNodeContents(element);
		selection.removeAllRanges();
		selection.addRange(range);
	}

	async function copy(key: keyof BadgeSnippets) {
		clearTimeout(timer);
		const written = await (navigator.clipboard?.writeText(snippets[key]) ?? Promise.reject()).then(
			() => true,
			() => false
		);
		copied = written ? key : null;
		manual = written ? null : key;
		if (written) timer = setTimeout(() => (copied = null), 3000);
		else selectCode(key);
	}

	function choose(event: Event) {
		kind = (event.currentTarget as HTMLSelectElement).value as BadgeKind;
		copied = null;
		manual = null;
	}
</script>

<div class="body">
	<p class="note">
		Live images of this team’s numbers for a website, a GitHub README or a sponsor deck. They update
		about once an hour.
	</p>
	<div class="pick">
		<label class="ctl-label" for={selectId}>Badge</label>
		<select id={selectId} class="ctl-select" value={kind} onchange={choose}>
			{#each BADGE_KINDS as entry (entry.kind)}
				<option value={entry.kind}>{entry.label}</option>
			{/each}
		</select>
	</div>
	<div class="previews">
		<figure data-theme="light">
			<img src={badgePath(number, kind)} {alt} />
			<figcaption>Light</figcaption>
		</figure>
		<figure data-theme="dark">
			<img src={badgePath(number, kind, 'dark')} {alt} />
			<figcaption>Dark</figcaption>
		</figure>
	</div>
	<dl class="snippets">
		{#each FORMATS as format (format.key)}
			<div class="snippet">
				<dt>{format.label}</dt>
				<dd>
					<pre bind:this={codes[format.key]}><code>{snippets[format.key]}</code></pre>
					<div class="actions">
						<button type="button" class="ctl-btn" onclick={() => copy(format.key)}>
							Copy {format.label}
						</button>
						<span class={['status', manual === format.key && 'manual']} role="status">
							{#if copied === format.key}
								Copied
							{:else if manual === format.key}
								Selected. Press Ctrl+C or ⌘C to copy.
							{/if}
						</span>
					</div>
				</dd>
			</div>
		{/each}
	</dl>
	<p class="note">
		The HTML version swaps to the dark badge when the reader’s system is in dark mode. Add
		<code>?theme=dark</code> to any image URL for the dark one.
	</p>
</div>

<style>
	.body {
		display: grid;
		gap: 14px;
		padding: 2px 0 16px;
	}

	.note {
		color: var(--text-2);
		font-size: 13px;
		line-height: 1.5;
	}

	.pick {
		display: grid;
		gap: 4px;
		max-width: 240px;
	}

	.previews {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	figure {
		display: grid;
		gap: 8px;
		justify-items: start;
		min-width: 0;
		padding: 14px;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
	}

	img {
		display: block;
		max-width: 100%;
		height: auto;
	}

	figcaption {
		color: var(--text-3);
		font-size: 12px;
	}

	.snippets {
		display: grid;
		gap: 12px;
		margin: 0;
	}

	.snippet {
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	dt {
		font-size: 13px;
		font-weight: 600;
	}

	dd {
		display: grid;
		gap: 6px;
		min-width: 0;
		margin: 0;
	}

	pre {
		margin: 0;
		padding: 8px 10px;
		overflow-x: auto;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background: var(--surface);
		font-size: 12px;
		line-height: 1.5;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
	}

	.status {
		color: var(--ok);
		font-size: 13px;
	}

	.status.manual {
		color: var(--text-2);
	}

	.status:empty {
		display: none;
	}

	@media (max-width: 560px) {
		.previews {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
