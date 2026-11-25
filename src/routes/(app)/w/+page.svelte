<script lang="ts">
	import '#lib/components/tools/controls.css';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Button from '#lib/ui/Button.svelte';
	import Icon, { type IconName } from '#lib/ui/Icon.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import TeamInput from '#lib/ui/TeamInput.svelte';
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
			createError = /^[\d\s]*$/.test(team)
				? 'Enter your team number, 1 to 6 digits.'
				: 'Pick your team from the list, or enter its number.';
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

	const TOOLS: { name: string; icon: IconName; text: string }[] = [
		{
			name: 'Pick list',
			icon: 'list',
			text: 'Rank the teams you want for alliance selection. Picked teams cross out live.'
		},
		{
			name: 'Batteries',
			icon: 'battery',
			text: 'Track charge and voltage so the freshest battery goes in the robot.'
		},
		{
			name: 'Checklist',
			icon: 'check',
			text: 'The steps your team runs before every match, ticked off with initials.'
		},
		{
			name: 'Strategy board',
			icon: 'board',
			text: 'Draw paths on the field and save a plan for each match.'
		}
	];

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
	meta={data.shared
		? 'Shared tools for your team. No account needed.'
		: 'Tools for your team, saved in this browser. No account needed.'}
/>

<div class="start">
	<form class="part" onsubmit={create} novalidate>
		<h2 class="sec-title">Create a workspace</h2>
		<label class="ctl-label" for="{id}-team">Team number or name</label>
		<div class="row">
			<TeamInput
				id="{id}-team"
				placeholder="14624"
				listLabel="Teams"
				bind:value={team}
				invalid={Boolean(createError)}
				describedby={createError ? `${id}-create-error` : undefined}
			/>
			<Button type="submit" disabled={busy || !access}>Create</Button>
		</div>
		{#if createError}
			<p id="{id}-create-error" class="ctl-error" role="alert">{createError}</p>
		{/if}
	</form>

	<form class="part" onsubmit={join} novalidate>
		<h2 class="sec-title">Join your team</h2>
		<label class="ctl-label" for="{id}-code">Join code</label>
		<div class="row">
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
			<Button variant="secondary" type="submit" disabled={busy || !access}>Join</Button>
		</div>
		{#if joinError}
			<p id="{id}-join-error" class="ctl-error" role="alert">{joinError}</p>
		{/if}
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

<section class="tools" aria-labelledby="{id}-tools">
	<h2 class="visually-hidden" id="{id}-tools">In every workspace</h2>
	<dl>
		{#each TOOLS as tool (tool.name)}
			<div>
				<dt><Icon name={tool.icon} size={14} />{tool.name}</dt>
				<dd>{tool.text}</dd>
			</div>
		{/each}
	</dl>
</section>

<style>
	.start {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
	}

	.part {
		display: grid;
		gap: 8px;
		align-content: start;
		padding: 20px 22px 22px;
	}

	.part + .part {
		border-left: 1px solid var(--line);
	}

	.part h2 {
		margin-bottom: 4px;
	}

	.row {
		display: flex;
		gap: 8px;
		max-width: 360px;
	}

	.row input {
		flex: 1;
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

	.tools dl {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 20px 28px;
		margin: 8px 0 0;
	}

	.tools div {
		display: grid;
		gap: 4px;
		align-content: start;
		padding-top: 12px;
		border-top: 1px solid var(--line-2);
	}

	.tools dt {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		font-weight: 600;
	}

	.tools dd {
		font-size: 14px;
		color: var(--text-2);
		text-wrap: pretty;
	}

	@media (max-width: 900px) {
		.tools dl {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 760px) {
		.start {
			grid-template-columns: minmax(0, 1fr);
		}

		.part + .part {
			border-top: 1px solid var(--line);
			border-left: 0;
		}

		.row {
			max-width: none;
		}

		.recents a {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.recents .where {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 480px) {
		.tools dl {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
