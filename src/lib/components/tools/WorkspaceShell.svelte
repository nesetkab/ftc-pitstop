<script lang="ts">
	import '#lib/components/tools/controls.css';
	import { onMount, untrack, type Snippet } from 'svelte';
	import StorageNotice from '#lib/components/tools/StorageNotice.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Tabs, { type Tab } from '#lib/ui/Tabs.svelte';
	import { browserWorkspaces, type BrowserWorkspaces } from '#lib/workspace/browser.ts';
	import { setMatch } from '#lib/workspace/checklist.ts';
	import { formatCode } from '#lib/workspace/code.ts';
	import { rememberRecent } from '#lib/workspace/recents.ts';
	import { setWorkspace, Workspace } from '#lib/workspace/workspace.svelte.ts';

	interface Props {
		code: string;
		shared: boolean;
		children: Snippet;
	}

	let { code, shared, children }: Props = $props();

	const workspace = untrack(() => new Workspace(code));
	setWorkspace(workspace);

	const id = $props.id();
	let access: BrowserWorkspaces | null = null;
	let stop = () => {};
	let closed = false;
	let copied = $state(false);

	const tabs = $derived([
		{ href: `/w/${code}/picklist`, label: 'Pick list', icon: 'list' },
		{ href: `/w/${code}/batteries`, label: 'Batteries', icon: 'battery' },
		{ href: `/w/${code}/checklist`, label: 'Checklist', icon: 'check' },
		{ href: `/w/${code}/board`, label: 'Strategy board', icon: 'board' }
	] satisfies Tab[]);

	const title = $derived(
		workspace.meta?.teamNumber ? `Team ${workspace.meta.teamNumber}` : 'Team workspace'
	);

	async function open() {
		if (!access) return;
		stop();
		await workspace.open(access.access);
		if (closed || workspace.status !== 'ready') return;
		stop = workspace.start();
		rememberRecent(access.storage, {
			code,
			teamNumber: workspace.meta?.teamNumber ?? null,
			kind: workspace.kind,
			openedAt: Date.now()
		});
	}

	onMount(() => {
		access = browserWorkspaces(shared);
		void open();
		return () => {
			closed = true;
			stop();
			void workspace.flush();
		};
	});

	async function copyCode() {
		copied = await navigator.clipboard.writeText(formatCode(code)).then(
			() => true,
			() => false
		);
		if (copied) setTimeout(() => (copied = false), 3000);
	}
</script>

<svelte:head>
	<title>Team tools - PitStop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if workspace.status === 'loading'}
	<p class="muted" role="status">Loading the workspace.</p>
{:else if workspace.status === 'missing'}
	<EmptyState title="No workspace uses the code {formatCode(code)}.">
		Check the code with your team, or make a new workspace.
	</EmptyState>
	<div>
		<Button href="/w">Team workspaces</Button>
	</div>
{:else if workspace.status === 'error'}
	<EmptyState title="The workspace could not be loaded.">Check your connection.</EmptyState>
	<div>
		<Button icon="refresh" onclick={open}>Try again</Button>
	</div>
{:else}
	<PageHeader
		{title}
		meta={workspace.kind === 'shared' ? undefined : `Join code ${formatCode(code)}`}
	>
		{#snippet status()}
			<StorageNotice
				kind={workspace.kind}
				sync={workspace.sync}
				savedAt={workspace.savedAt}
				code={formatCode(code)}
			/>
		{/snippet}
		{#snippet actions()}
			<div class="match">
				<label class="ctl-label" for="{id}-match">Next match</label>
				<input
					id="{id}-match"
					class="ctl-input"
					maxlength="16"
					autocomplete="off"
					value={workspace.docs.checklist.match}
					onchange={(event) => {
						const value = event.currentTarget.value;
						workspace.update('checklist', (current) => setMatch(current, value));
					}}
				/>
			</div>
			{#if workspace.kind === 'shared'}
				<button type="button" class="ctl-btn" onclick={copyCode}>
					{copied ? 'Code copied' : 'Copy join code'}
				</button>
			{/if}
		{/snippet}
	</PageHeader>
	<Tabs {tabs} label="Team tools" />
	<div class="sync" role="status">
		{#if workspace.unsaved || workspace.offline}
			<p class="trouble">
				<span class="dot" aria-hidden="true"></span>
				<span class="text">
					{workspace.unsaved
						? (workspace.message ?? 'Not saved yet.')
						: 'Offline. Showing the last copy.'}
				</span>
				{#if workspace.sync === 'retrying'}
					<button type="button" class="ctl-btn" onclick={() => workspace.retry()}>Retry now</button>
				{/if}
			</p>
		{/if}
	</div>
	{@render children()}
{/if}

<style>
	.sync {
		position: sticky;
		top: 0;
		z-index: 10;
		margin-block: -8px;
	}

	.sync:empty {
		display: none;
	}

	.trouble {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 8px 8px 12px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		font-size: 14px;
	}

	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--red);
	}

	.text {
		flex: 1 1 auto;
	}

	.match {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.match input {
		width: 96px;
	}
</style>
