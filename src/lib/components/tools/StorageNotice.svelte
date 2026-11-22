<script lang="ts">
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import type { SyncState } from '#lib/workspace/workspace.svelte.ts';
	import type { WorkspaceKind } from '#lib/workspace/types.ts';

	interface Props {
		kind: WorkspaceKind;
		sync?: SyncState;
		savedAt?: number | null;
		offline?: boolean;
		message?: string | null;
	}

	let { kind, sync = 'saved', savedAt = null, offline = false, message = null }: Props = $props();
</script>

{#if kind === 'shared'}
	<b>Shared with your team.</b> Anyone with the join code can see and edit it.
{:else if kind === 'memory'}
	<b>Not saved.</b> This browser is blocking storage, so changes are lost when you close the page. Copy
	a share link to keep a copy.
{:else}
	<b>Saved on this device.</b> Teammates on other devices cannot see it. Copy a share link to send them
	a tool.
{/if}
{#if sync === 'saving'}
	Saving.
{:else if sync === 'retrying' || sync === 'failed'}
	<span class="problem">{message ?? 'Not saved yet.'}</span>
{:else if offline}
	<span class="problem">Offline. Showing the last copy.</span>
{:else if savedAt !== null && kind === 'shared'}
	<StaleNotice updated={savedAt} prefix="Saved" staleAfter={Infinity} />.
{/if}

<style>
	.problem {
		margin-inline: -4px;
		padding: 1px 4px;
		border-radius: var(--radius-chip);
		background: var(--surface);
		color: var(--text);
	}
</style>
