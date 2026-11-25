<script lang="ts">
	import type { Snippet } from 'svelte';
	import PickList from '#lib/components/tools/PickList.svelte';
	import { browserWorkspaces } from '#lib/workspace/browser.ts';
	import { formatCode } from '#lib/workspace/code.ts';
	import { pickMarks, type PickMark, type PickStat } from '#lib/workspace/picklist.ts';
	import type { Recent } from '#lib/workspace/recents.ts';
	import { Workspace } from '#lib/workspace/workspace.svelte.ts';

	interface Props {
		shared: boolean;
		recents: Recent[];
		chosen: string | null;
		labels: ReadonlyMap<number, string>;
		stats: ReadonlyMap<number, PickStat>;
		loading: Snippet;
		onmarks: (marks: ReadonlyMap<number, PickMark> | undefined) => void;
	}

	let { shared, recents, chosen = $bindable(), labels, stats, loading, onmarks }: Props = $props();

	const id = $props.id();
	const access = $derived(browserWorkspaces(shared));
	let ours = $state.raw<Workspace | null>(null);

	$effect(() => {
		const code = chosen;
		const current = access;
		if (!code) {
			ours = null;
			return;
		}
		const next = new Workspace(code, { docs: ['picklist'] });
		let stop = () => {};
		let active = true;
		void next.open(current.access).then(() => {
			if (!active || next.status !== 'ready') return;
			stop = next.start();
			ours = next;
		});
		return () => {
			active = false;
			stop();
			ours = null;
		};
	});

	$effect(() => {
		onmarks(ours ? pickMarks(ours.docs.picklist) : undefined);
		return () => onmarks(undefined);
	});
</script>

{#if ours}
	<PickList list={ours.docs.picklist} auto={labels} {stats} title="Our pick list" showEvent={false}>
		{#snippet share()}
			<a href="/w/{ours?.code}/picklist">Edit pick list</a>
		{/snippet}
	</PickList>
	{#if recents.length > 1}
		<div class="choose">
			<label class="ctl-label" for="{id}-workspace">Workspace</label>
			<select id="{id}-workspace" class="ctl-select" bind:value={chosen}>
				{#each recents as recent (recent.code)}
					<option value={recent.code}>
						{recent.teamNumber ? `Team ${recent.teamNumber}` : 'Saved from a link'},
						{formatCode(recent.code)}
					</option>
				{/each}
			</select>
		</div>
	{/if}
	<p class="note">
		{ours.kind === 'shared' ? 'Shared with your team.' : 'Saved on this device.'}
	</p>
{:else}
	{@render loading()}
{/if}

<style>
	.choose {
		display: grid;
		gap: 4px;
	}
</style>
