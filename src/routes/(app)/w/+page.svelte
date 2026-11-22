<script lang="ts">
	import '#lib/components/tools/controls.css';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Button from '#lib/ui/Button.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { browserWorkspaces, type BrowserWorkspaces } from '#lib/workspace/browser.ts';
	import { formatCode, normalizeCode, parseTeamNumber } from '#lib/workspace/code.ts';
	import { readRecents, rememberRecent, type Recent } from '#lib/workspace/recents.ts';
	import { WorkspaceError } from '#lib/workspace/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const id = $props.id();
	let access = $state.raw<BrowserWorkspaces | null>(null);
	let recents = $state<Recent[]>([]);
	let team = $state('');
	let code = $state('');
	let createError = $state('');
	let joinError = $state('');
	let busy = $state(false);

	onMount(() => {
		access = browserWorkspaces(data.shared);
		recents = readRecents(access.storage);
	});

	function explain(error: unknown): string {
		if (error instanceof WorkspaceError && error.code === 'rate-limited') {
			return 'Too many requests. Try again in a minute.';
		}
		return 'The shared workspace could not be reached. Try again.';
	}

	async function create(event: SubmitEvent) {
		event.preventDefault();
		if (!access) return;
		const teamNumber = parseTeamNumber(team);
		if (teamNumber === null) {
			createError = 'Enter your team number, 1 to 6 digits.';
			return;
		}
		createError = '';
		busy = true;
		try {
			const store = access.remote ?? access.device;
			const meta = await store.create({ teamNumber });
			rememberRecent(access.storage, {
				code: meta.code,
				teamNumber,
				kind: store.kind,
				openedAt: Date.now()
			});
			await goto(`/w/${meta.code}/picklist`);
		} catch (error) {
			createError = explain(error);
		} finally {
			busy = false;
		}
	}

	async function join(event: SubmitEvent) {
		event.preventDefault();
		if (!access) return;
		const normalized = normalizeCode(code);
		if (!normalized) {
			joinError = 'A join code has 6 letters and numbers.';
			return;
		}
		joinError = '';
		busy = true;
		try {
			let found: { teamNumber: number | null; kind: Recent['kind'] } | null = null;
			let unreachable = false;
			for (const store of access.access.stores) {
				const snapshot = await store.load(normalized, { docs: ['picklist'] }).catch(() => {
					unreachable = true;
					return null;
				});
				if (snapshot) {
					found = { teamNumber: snapshot.meta.teamNumber, kind: store.kind };
					break;
				}
			}
			if (!found) {
				joinError = unreachable
					? 'The shared workspace could not be reached. Try again.'
					: data.shared
						? 'No workspace uses that code.'
						: 'That code is not saved on this device. Ask your team for a share link instead.';
				return;
			}
			rememberRecent(access.storage, {
				code: normalized,
				teamNumber: found.teamNumber,
				kind: found.kind,
				openedAt: Date.now()
			});
			await goto(`/w/${normalized}/picklist`);
		} finally {
			busy = false;
		}
	}

	function where(kind: Recent['kind']): string {
		return kind === 'shared' ? 'Shared with the team' : 'On this device';
	}
</script>

<svelte:head>
	<title>Team workspace - PitStop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<PageHeader
	title="Team workspace"
	meta="A pick list, battery log, checklist and strategy board for your team. No account needed."
>
	{#snippet status()}
		{#if data.shared}
			<b>Shared with your team.</b> Anyone with the join code can see and edit it.
		{:else}
			<b>Saved on this device.</b> Workspaces stay in this browser. Use Copy share link in any tool to
			send it to a teammate.
		{/if}
	{/snippet}
</PageHeader>

<div class="forms">
	<form class="panel" onsubmit={create} novalidate>
		<h2 class="sec-title">Create a team workspace</h2>
		<label class="ctl-label" for="{id}-team">Team number</label>
		<input
			id="{id}-team"
			class="ctl-input"
			inputmode="numeric"
			autocomplete="off"
			maxlength="6"
			placeholder="14624"
			bind:value={team}
			aria-invalid={createError ? 'true' : undefined}
			aria-describedby={createError ? `${id}-create-error` : undefined}
		/>
		{#if createError}
			<p id="{id}-create-error" class="ctl-error" role="alert">{createError}</p>
		{/if}
		<div>
			<Button type="submit" disabled={busy || !access}>Create workspace</Button>
		</div>
		<p class="note">
			{data.shared
				? 'You get a join code. Anyone with it can see and edit the workspace.'
				: 'The workspace is saved in this browser, and the join code names it here.'}
		</p>
	</form>

	<form class="panel" onsubmit={join} novalidate>
		<h2 class="sec-title">Join a workspace</h2>
		<label class="ctl-label" for="{id}-code">Join code</label>
		<input
			id="{id}-code"
			class="ctl-input code"
			autocomplete="off"
			autocapitalize="characters"
			spellcheck="false"
			maxlength="8"
			placeholder="ABC-DEF"
			bind:value={code}
			aria-invalid={joinError ? 'true' : undefined}
			aria-describedby={joinError ? `${id}-join-error` : undefined}
		/>
		{#if joinError}
			<p id="{id}-join-error" class="ctl-error" role="alert">{joinError}</p>
		{/if}
		<div>
			<Button variant="secondary" type="submit" disabled={busy || !access}>Join workspace</Button>
		</div>
		<p class="note">
			{data.shared
				? 'Ask a teammate for the code. It has 6 letters and numbers.'
				: 'Only workspaces saved on this device can be joined by code.'}
		</p>
	</form>
</div>

{#if recents.length > 0}
	<section class="recents" aria-labelledby="{id}-recents">
		<h2 class="sec-title" id="{id}-recents">Workspaces on this device</h2>
		<ul>
			{#each recents as recent (recent.code)}
				<li>
					<a href="/w/{recent.code}/picklist">
						<b>{recent.teamNumber ? `Team ${recent.teamNumber}` : 'Saved from a link'}</b>
						<span class="code">{formatCode(recent.code)}</span>
						<span class="where">{where(recent.kind)}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.forms {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 28px;
		align-items: start;
	}

	.panel {
		display: grid;
		gap: 10px;
		align-content: start;
		padding: 18px;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
	}

	.code {
		text-transform: uppercase;
	}

	.recents {
		display: grid;
		gap: 8px;
	}

	.recents ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.recents a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: 16px;
		align-items: baseline;
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
		text-decoration: none;
	}

	.recents a:hover b {
		text-decoration: underline;
	}

	.recents b {
		font-weight: 600;
	}

	.recents .code {
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
	}

	.recents .where {
		color: var(--text-2);
		font-size: 13px;
	}

	@media (max-width: 760px) {
		.forms {
			grid-template-columns: minmax(0, 1fr);
		}

		.recents a {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.recents .where {
			grid-column: 1 / -1;
		}
	}
</style>
