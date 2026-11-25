<script lang="ts">
	import '#lib/components/tools/controls.css';
	import { encodeShare, shareUrl } from '#lib/workspace/share.ts';
	import type { SharePayload } from '#lib/workspace/schemas.ts';

	interface Props {
		build: () => SharePayload;
		label?: string;
	}

	let { build, label = 'Copy share link' }: Props = $props();

	const MAX_LINK_LENGTH = 30_000;

	type Result = 'idle' | 'copied' | 'manual' | 'large' | 'failed';

	let result = $state<Result>('idle');
	let link = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	const inputId = $props.id();

	async function copyText(text: Promise<string>): Promise<boolean> {
		const clipboard = navigator.clipboard;
		if (!clipboard) return false;
		if (typeof ClipboardItem !== 'undefined' && clipboard.write) {
			const blob = text.then((value) => new Blob([value], { type: 'text/plain' }));
			const written = await clipboard.write([new ClipboardItem({ 'text/plain': blob })]).then(
				() => true,
				() => false
			);
			if (written) return true;
		}
		return clipboard.writeText(await text).then(
			() => true,
			() => false
		);
	}

	async function share() {
		clearTimeout(timer);
		const payload = build();
		const url = encodeShare(payload).then((token) =>
			token.length > MAX_LINK_LENGTH ? '' : shareUrl(location.origin, payload.tool, token)
		);
		const copied = await copyText(url).catch(() => false);
		link = await url.catch(() => '');
		if (!link) result = 'failed';
		else if (copied) result = 'copied';
		else result = 'manual';
		if (result === 'copied') timer = setTimeout(() => (result = 'idle'), 4000);
	}

	function select(event: FocusEvent) {
		(event.currentTarget as HTMLInputElement).select();
	}
</script>

<div class="share">
	<button type="button" class="ctl-btn" onclick={share}>{label}</button>
	<span class="status" role="status">
		{#if result === 'copied'}
			Link copied.
		{:else if result === 'failed'}
			This is too large for a link.
		{/if}
	</span>
	{#if result === 'manual'}
		<label class="ctl-label" for={inputId}>Copy this link</label>
		<input id={inputId} class="ctl-input" readonly value={link} onfocus={select} />
	{/if}
</div>

<style>
	.share {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		min-width: 0;
	}

	.status {
		font-size: 13px;
		color: var(--text-2);
	}

	.status:empty {
		display: none;
	}

	input {
		flex: 1 1 100%;
	}
</style>
