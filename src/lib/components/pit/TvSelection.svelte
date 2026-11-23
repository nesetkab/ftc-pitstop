<script lang="ts">
	import { fixed } from '#lib/format/number.ts';
	import { pct } from '#lib/format/pct.ts';
	import Facts from './Facts.svelte';
	import RowFit from './RowFit.svelte';
	import TeamTag from './TeamTag.svelte';
	import { eventFacts, roleText } from './copy.ts';
	import type { PitView } from './view.ts';

	interface Props {
		view: PitView;
		availableRows?: number;
	}

	let { view, availableRows = 16 }: Props = $props();

	const picked = $derived(view.role !== null);
	const withOpr = $derived(view.available.some((team) => team.opr !== null));
	const withOdds = $derived(view.available.some((team) => team.winEvent !== null));
	const available = $derived(view.available.slice(0, availableRows));

	function members(seed: number) {
		const alliance = view.alliances.find((item) => item.seed === seed)!;
		return [alliance.captain, ...alliance.picks, ...(alliance.backup ? [alliance.backup] : [])];
	}
</script>

<div class="cols" style:--cols="31em 23em minmax(0, 1fr)">
	<section>
		<h2 class="tv-label">Alliance selection</h2>
		<p class={['status', { picked }]}>{roleText(view)}</p>
		{#if view.picking !== null}
			<p class="sub">Alliance {view.picking} is picking.</p>
		{/if}
		{#if view.alliance}
			<h2 class="tv-label">Our alliance</h2>
			<ul class="members">
				{#each members(view.alliance.seed) as number (number)}
					<li>
						<TeamTag {number} me={number === view.team} />
						<span>{view.names.get(number) ?? ''}</span>
					</li>
				{/each}
			</ul>
		{/if}
		<h2 class="tv-label">This event</h2>
		<Facts facts={eventFacts(view)} />
	</section>
	<section>
		<h2 class="tv-label">Alliances</h2>
		{#if view.alliances.length > 0}
			<ol class="alliances">
				{#each view.alliances as alliance (alliance.seed)}
					<li
						class={{
							mine: alliance.seed === view.alliance?.seed,
							picking: alliance.seed === view.picking
						}}
					>
						<span class="seed">{alliance.seed}</span>
						<span class="teams">
							{#each members(alliance.seed) as number (number)}
								<TeamTag {number} me={number === view.team} />
							{/each}
							{#if alliance.seed === view.picking}
								<span class="note">Picking</span>
							{/if}
						</span>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="sub">No picks yet.</p>
		{/if}
	</section>
	<section class="fill">
		<h2 class="tv-label">
			{view.picksFor === null ? 'Available teams' : `Best picks for alliance ${view.picksFor}`}
		</h2>
		<RowFit count={available.length}>
			{#snippet children(shown)}
				<table class="available">
					<caption class="visually-hidden">Available teams</caption>
					<thead>
						<tr>
							<th class="l" scope="col">#</th>
							<th class="l" scope="col">Team</th>
							<th class="l" scope="col"><span class="visually-hidden">Name</span></th>
							<th scope="col">{withOpr ? 'OPR' : 'RS'}</th>
							{#if withOdds}<th scope="col">Win event</th>{/if}
						</tr>
					</thead>
					<tbody>
						{#each available.slice(0, shown) as team (team.number)}
							<tr class={{ me: team.number === view.team }}>
								<td class="l">{team.rank ?? ''}</td>
								<td class="l">{team.number}</td>
								<td class="name">{team.name ?? ''}</td>
								<td>{withOpr ? fixed(team.opr, 1) : fixed(team.rs, 2)}</td>
								{#if withOdds}<td>{pct(team.winEvent)}</td>{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			{/snippet}
		</RowFit>
	</section>
</div>

<style>
	.status {
		font-size: 2.4em;
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.status.picked {
		color: var(--accent);
	}

	.sub {
		font-size: 0.9em;
		color: var(--text-2);
	}

	.members {
		display: grid;
		gap: 0.4em;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.members li {
		display: flex;
		align-items: center;
		gap: 0.6em;
		font-size: 1.1em;
	}

	.members span {
		color: var(--text-2);
	}

	.alliances {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.alliances li {
		display: grid;
		grid-template-columns: 1.6em minmax(0, 1fr);
		align-items: center;
		gap: 0.6em;
		padding: 0.5em 0;
		border-bottom: 1px solid var(--line);
	}

	.alliances li.mine {
		margin: 0 -0.5em;
		padding-inline: 0.5em;
		background: var(--line);
	}

	.seed {
		font-size: 1.3em;
		font-weight: 600;
	}

	.teams {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4em;
		font-size: 1.05em;
	}

	.note {
		font-size: 0.75em;
		color: var(--text-2);
	}

	.available {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}

	th {
		padding-inline: 0.5em;
		box-shadow: inset 0 -1px var(--line-2);
		color: var(--text-3);
		font-weight: 500;
		text-align: right;
		vertical-align: bottom;
		white-space: nowrap;
	}

	td {
		padding-inline: 0.5em;
		box-shadow: inset 0 -1px var(--line);
		text-align: right;
		white-space: nowrap;
	}

	.l {
		text-align: left;
	}

	.name {
		width: 100%;
		max-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: left;
		color: var(--text-2);
	}

	.me td {
		background: var(--accent);
		box-shadow: 1px 0 var(--accent);
		color: var(--on-accent);
		font-weight: 600;
	}
</style>
