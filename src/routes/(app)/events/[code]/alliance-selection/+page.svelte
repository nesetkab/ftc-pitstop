<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import '#lib/components/tools/controls.css';
	import { teamsAction } from '#lib/components/event/empty.ts';
	import type { EventBundle } from '#lib/types.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import SkeletonRows from '#lib/ui/SkeletonRows.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import type { PickMark } from '#lib/workspace/picklist.ts';
	import { readRecents, type Recent } from '#lib/workspace/recents.ts';
	import {
		bundleSignature,
		deriveSelection,
		refreshInterval,
		selectionTable,
		takenLabels
	} from '#lib/workspace/selection.ts';
	import AllianceTable from './AllianceTable.svelte';
	import AvailableTeams from './AvailableTeams.svelte';
	import PlayoffOdds from './PlayoffOdds.svelte';
	import SimulateAlliances from './SimulateAlliances.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const teams = $derived(teamsAction(data.selection.bundle));
	let live = $state.raw<EventBundle | null>(null);
	let refreshFailed = $state(false);
	let ready = $state(false);
	let recents = $state.raw<Recent[]>([]);
	let chosen = $state<string | null>(null);
	let marks = $state.raw<ReadonlyMap<number, PickMark> | undefined>(undefined);

	const bundle = $derived<EventBundle>(
		live && live.fetchedAt >= data.selection.bundle.fetchedAt ? live : data.selection.bundle
	);
	const analysis = $derived(data.selection.analysis);
	const selection = $derived(deriveSelection(bundle.alliances));
	const table = $derived(selectionTable(bundle, analysis, selection));
	const labels = $derived(takenLabels(selection));
	const stats = $derived(
		new Map(
			[...table.available, ...table.taken].map((row) => [
				row.team,
				{ opr: row.opr, rank: row.rank }
			])
		)
	);
	const ongoing = $derived(
		bundle.phase === 'selection' && (!selection.started || selection.picking !== null)
	);
	const me = $derived(recents.find((recent) => recent.code === chosen)?.teamNumber ?? null);
	const picker = $derived(
		selection.picking
			? {
					seed: selection.picking.seed,
					team: selection.picking.captain,
					name: bundle.teams.find((team) => team.number === selection.picking?.captain)?.name
				}
			: null
	);
	const note = $derived(
		table.picks && table.pickAlliance !== null && selection.picking
			? `Playoff chances assume alliance ${table.pickAlliance} (${selection.picking.captain}) picks that team.`
			: null
	);

	const loadPickList = () => import('./OurPickList.svelte');

	async function savedRecents(): Promise<Recent[]> {
		try {
			localStorage.setItem('ps-probe', '1');
			localStorage.removeItem('ps-probe');
			return readRecents(localStorage);
		} catch {
			const { browserStorage } = await import('#lib/workspace/device-store.ts');
			return readRecents(browserStorage().storage);
		}
	}

	onMount(() => {
		let signature = bundleSignature(bundle);
		let timer: ReturnType<typeof setTimeout> | undefined;
		let stopped = false;

		async function refresh() {
			const response = await fetch(`/api/events/${bundle.event.code}`).catch(() => null);
			const next: EventBundle | null = response?.ok
				? await response.json().catch(() => null)
				: null;
			refreshFailed = next === null;
			if (!next) return;
			live = next;
			const changed = bundleSignature(next);
			if (changed !== signature) {
				signature = changed;
				void invalidate('app:alliance-selection');
			}
		}

		async function tick() {
			if (stopped) return;
			if (!document.hidden && refreshInterval(bundle.phase) !== null) await refresh();
			if (stopped) return;
			clearTimeout(timer);
			timer = setTimeout(tick, refreshInterval(bundle.phase) ?? 60_000);
		}

		function wake() {
			if (document.hidden || stopped) return;
			clearTimeout(timer);
			void tick();
		}

		timer = setTimeout(tick, refreshInterval(bundle.phase) ?? 60_000);
		document.addEventListener('visibilitychange', wake);

		void savedRecents().then((saved) => {
			if (stopped) return;
			recents = saved;
			chosen = saved[0]?.code ?? null;
			ready = true;
		});

		return () => {
			stopped = true;
			clearTimeout(timer);
			document.removeEventListener('visibilitychange', wake);
		};
	});
</script>

{#snippet loading()}
	<h3 class="sec-title">Our pick list</h3>
	<SkeletonRows label="Loading the pick list." rows={8} />
{/snippet}

<div class="page">
	<div class="head">
		<h2 class="visually-hidden">Alliance selection</h2>
		<p class="status">
			<StaleNotice
				updated={bundle.fetchedAt}
				timeZone={bundle.event.timezone}
				staleAfter={ongoing ? undefined : Infinity}
			/>{#if refreshFailed}. The page couldn't refresh just now.{/if}
		</p>
	</div>

	{#if !selection.started}
		<EmptyState title="Alliances show here once qualification matches are done." action={teams} />
	{:else if picker}
		<div class="picking" role="status">
			<b>Alliance {picker.seed} is picking: {picker.team}{picker.name ? ` ${picker.name}` : ''}</b>
			<span>{selection.completed} of {selection.alliances.length} alliances complete</span>
		</div>
	{:else}
		<p class="done" role="status">
			<b>Alliance selection is complete.</b>
		</p>
	{/if}

	<div class="as" class:single={!selection.started}>
		<div class="side">
			{#if selection.started}
				<div class="panel">
					<h3 class="sec-title">Alliances</h3>
					<AllianceTable {selection} {me} />
				</div>
				{#if selection.alliances.length >= 2}
					<div class="panel">
						<h3 class="sec-title">Simulate a playoff match</h3>
						<SimulateAlliances alliances={selection.alliances} />
					</div>
				{/if}
				{#if analysis?.playoffs && analysis.playoffs.length > 0 && bundle.phase !== 'done'}
					<div class="panel">
						<h3 class="sec-title">Chance to win the event</h3>
						<PlayoffOdds odds={analysis.playoffs} />
					</div>
				{/if}
			{/if}
			{#if chosen}
				<div class="panel">
					{#await loadPickList()}
						{@render loading()}
					{:then { default: OurPickList }}
						<OurPickList
							shared={data.workspaceShared}
							{recents}
							bind:chosen
							{labels}
							{stats}
							{loading}
							onmarks={(next) => (marks = next)}
						/>
					{:catch}
						<h3 class="sec-title">Our pick list</h3>
						<p class="note">The pick list couldn't load.</p>
					{/await}
				</div>
			{:else if ready}
				<div class="panel">
					<h3 class="sec-title">Our pick list</h3>
					<EmptyState title="Make a shared pick list with your team.">
						<a href="/w">Start a team workspace</a> to see your list here next to the live picks.
					</EmptyState>
				</div>
			{/if}
		</div>

		{#if selection.started}
			<div class="panel main">
				<h3 class="sec-title">{selection.complete ? 'Teams' : 'Available teams'}</h3>
				<AvailableTeams {table} {me} {marks} eventCode={bundle.event.code} />
				{#if note}
					<p class="note">{note}</p>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.page {
		display: grid;
		gap: var(--space-stack);
		min-width: 0;
	}

	.head {
		display: grid;
		gap: 6px;
	}

	.status {
		color: var(--text-2);
		font-size: 14px;
	}

	.picking {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px 12px;
		padding: 12px 16px;
		border-radius: var(--radius-control);
		background: var(--surface);
	}

	.picking b {
		font-weight: 600;
	}

	.picking span {
		color: var(--text-2);
		font-size: 14px;
	}

	.done {
		color: var(--text-2);
		font-size: 15px;
	}

	.done b {
		color: var(--text);
		font-weight: 600;
	}

	.as {
		display: grid;
		grid-template-columns: 270px minmax(0, 1fr);
		gap: var(--space-columns);
		align-items: start;
	}

	.as.single {
		grid-template-columns: minmax(0, 560px);
	}

	.as > * {
		min-width: 0;
	}

	.side {
		display: grid;
		gap: var(--space-stack);
		align-content: start;
	}

	.panel {
		display: grid;
		gap: var(--space-title);
		align-content: start;
		min-width: 0;
	}

	@media (min-width: 1061px) {
		.side {
			position: sticky;
			top: 16px;
			max-height: calc(100dvh - 32px);
			padding: 2px;
			margin: -2px;
			overflow-y: auto;
		}
	}

	@media (max-width: 1060px) {
		.as {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
