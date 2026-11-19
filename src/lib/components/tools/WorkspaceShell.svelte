<script lang="ts">
	import '#lib/components/tools/controls.css';
	import { onMount, untrack, type Snippet } from 'svelte';
	import StorageNotice from '#lib/components/tools/StorageNotice.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Tabs from '#lib/ui/Tabs.svelte';
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
	let copied = $state(false);

	const tabs = $derived([
		{ href: `/w/${code}/picklist`, label: 'Pick list' },
		{ href: `/w/${code}/batteries`, label: 'Batteries' },
		{ href: `/w/${code}/checklist`, label: 'Checklist' },
		{ href: `/w/${code}/board`, label: 'Strategy board' }
	]);

	const meta = $derived(
		[
			workspace.meta?.teamNumber ? `Team ${workspace.meta.teamNumber}.` : '',
			`Join code ${formatCode(code)}.`
		]
			.filter(Boolean)
			.join(' ')
	);

	async function open() {
		if (!access) return;
		stop();
		await workspace.open(access.access);
		if (workspace.status !== 'ready') return;
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
	<title>Team tools</title>
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
	<EmptyState title="The workspace could not be loaded.">
		Check the connection and try again.
	</EmptyState>
	<div>
		<Button onclick={open}>Try again</Button>
	</div>
{:else}
	<PageHeader title="Team tools" {meta}>
		{#snippet status()}
			<StorageNotice
				kind={workspace.kind}
				sync={workspace.sync}
				savedAt={workspace.savedAt}
				offline={workspace.offline}
				message={workspace.message}
			/>
		{/snippet}
		{#snippet actions()}
			<div class="match">
				<label class="ctl-label" for="{id}-match">Next match</label>
				<input
					id="{id}-match"
					class="ctl-input"
					maxlength="16"
					placeholder="Q26"
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
	{@render children()}
{/if}

<style>
	.match {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.match input {
		width: 96px;
	}
</style>
