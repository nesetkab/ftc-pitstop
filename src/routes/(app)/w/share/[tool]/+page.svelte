<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import BatteryLog from '#lib/components/tools/BatteryLog.svelte';
	import Checklist from '#lib/components/tools/Checklist.svelte';
	import PickList from '#lib/components/tools/PickList.svelte';
	import StrategyBoard from '#lib/components/tools/StrategyBoard.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import SkeletonRows from '#lib/ui/SkeletonRows.svelte';
	import { browserWorkspaces } from '#lib/workspace/browser.ts';
	import type { SharePayload, ShareTool } from '#lib/workspace/schemas.ts';
	import { saveShared } from '#lib/workspace/save-shared.ts';
	import { decodeShare } from '#lib/workspace/share.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const TITLES: Record<ShareTool, string> = {
		picklist: 'Shared pick list',
		batteries: 'Shared battery log',
		checklist: 'Shared checklist',
		board: 'Shared plan'
	};

	let payload = $state.raw<SharePayload | null>(null);
	let phase = $state<'loading' | 'ready' | 'invalid'>('loading');
	let saving = $state(false);
	let failure = $state('');

	onMount(async () => {
		const decoded = await decodeShare(location.hash);
		if (decoded && decoded.tool === data.tool) {
			payload = decoded;
			phase = 'ready';
		} else {
			phase = 'invalid';
		}
	});

	async function save() {
		if (!payload) return;
		saving = true;
		failure = '';
		try {
			const { device, storage } = browserWorkspaces(false);
			const saved = await saveShared(payload, device, storage);
			await goto(`/w/${saved.code}/${saved.tool}`);
		} catch {
			failure = "This device couldn't save the copy. Its storage may be full or blocked.";
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{TITLES[data.tool]}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if phase === 'loading'}
	<SkeletonRows label="Opening the shared copy." header />
{:else if phase === 'invalid' || !payload}
	<PageHeader title={TITLES[data.tool]} />
	<EmptyState title="This link is damaged or incomplete.">
		Ask the sender for a new share link.
	</EmptyState>
	<div>
		<Button href="/w">Team workspaces</Button>
	</div>
{:else}
	<PageHeader
		title={TITLES[payload.tool]}
		meta={payload.team ? `From team ${payload.team}.` : undefined}
	>
		{#snippet status()}
			This shared copy is read only. Save it to this device to edit it.
		{/snippet}
		{#snippet actions()}
			<Button onclick={save} disabled={saving}>Save to this device</Button>
		{/snippet}
	</PageHeader>
	{#if failure}
		<p class="failure" role="alert">{failure}</p>
	{/if}
	{#if payload.tool === 'picklist'}
		<PickList list={payload.data} />
	{:else if payload.tool === 'batteries'}
		<BatteryLog batteries={payload.data} />
	{:else if payload.tool === 'checklist'}
		<Checklist checklist={payload.data} />
	{:else}
		<StrategyBoard boards={{ plans: [payload.data] }} />
	{/if}
{/if}

<style>
	.failure {
		color: var(--red);
		font-size: 14px;
	}
</style>
