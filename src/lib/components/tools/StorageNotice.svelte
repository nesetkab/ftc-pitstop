<script lang="ts">
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import type { SyncState } from '#lib/workspace/workspace.svelte.ts';
	import type { WorkspaceKind } from '#lib/workspace/types.ts';

	interface Props {
		kind: WorkspaceKind;
		sync?: SyncState;
		savedAt?: number | null;
		code?: string;
	}

	let { kind, sync = 'saved', savedAt = null, code }: Props = $props();
</script>

{#if kind === 'shared'}
	<b>Shared with your team.</b> Anyone with {code ? `join code ${code}` : 'the join code'} can see and
	edit it.
{:else if kind === 'memory'}
	<b>Not saved.</b> This browser blocks storage, so changes are lost when you close the page.
{:else}
	<b>Saved on this device.</b> Teammates on other devices can't see it.
{/if}
{#if sync === 'saving'}
	Saving.
{:else if sync === 'saved' && savedAt !== null && kind === 'shared'}
	<StaleNotice updated={savedAt} prefix="Saved" staleAfter={Infinity} />.
{/if}
