<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
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

	const VIEWS = {
		picklist: () => import('#lib/components/tools/PickList.svelte'),
		batteries: () => import('#lib/components/tools/BatteryLog.svelte'),
		checklist: () => import('#lib/components/tools/Checklist.svelte'),
		board: () => import('#lib/components/tools/StrategyBoard.svelte')
	} satisfies Record<ShareTool, () => Promise<unknown>>;

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
		VIEWS[data.tool]().catch(() => {});
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
		{#await VIEWS.picklist() then { default: PickList }}
			<PickList list={payload.data} />
		{:catch}
			{@render failed()}
		{/await}
	{:else if payload.tool === 'batteries'}
		{#await VIEWS.batteries() then { default: BatteryLog }}
			<BatteryLog batteries={payload.data} />
		{:catch}
			{@render failed()}
		{/await}
	{:else if payload.tool === 'checklist'}
		{#await VIEWS.checklist() then { default: Checklist }}
			<Checklist checklist={payload.data} />
		{:catch}
			{@render failed()}
		{/await}
	{:else}
		{#await VIEWS.board() then { default: StrategyBoard }}
			<StrategyBoard boards={{ plans: [payload.data] }} />
		{:catch}
			{@render failed()}
		{/await}
	{/if}
{/if}

{#snippet failed()}
	<EmptyState title="This shared copy couldn't load."
		>Check your connection and try again.</EmptyState
	>
{/snippet}

<style>
	.failure {
		color: var(--red);
		font-size: 14px;
	}
</style>
