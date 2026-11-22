<script lang="ts">
	import Button from '#lib/ui/Button.svelte';
	import { compareHref, MAX_COMPARE, type CompareTeam } from './compare.ts';

	interface Props {
		teams: CompareTeam[];
		suggestions: { number: number; name: string | null }[];
	}

	let { teams, suggestions }: Props = $props();

	const id = $props.id();
	const numbers = $derived(teams.map((team) => team.number));
	const full = $derived(teams.length >= MAX_COMPARE);
</script>

<div class="picker">
	{#if teams.length > 0}
		<ul class="chosen" aria-label="Teams being compared">
			{#each teams as team (team.number)}
				<li>
					<a class="team" href="/teams/{team.number}"><b>{team.number}</b> {team.name}</a>
					<a
						class="remove"
						href={compareHref(numbers.filter((number) => number !== team.number))}
						aria-label="Remove {team.number}"
						data-sveltekit-noscroll>×</a
					>
				</li>
			{/each}
		</ul>
	{/if}
	{#if !full}
		<form class="add" method="get" action="/compare">
			{#if numbers.length > 0}
				<input type="hidden" name="teams" value={numbers.join(',')} />
			{/if}
			<label for="{id}-add" class="visually-hidden">Team number to add</label>
			<input
				id="{id}-add"
				name="add"
				type="text"
				inputmode="numeric"
				pattern="[0-9 ,]*"
				maxlength="30"
				autocomplete="off"
				placeholder={teams.length === 0 ? 'Team numbers, like 19666 7759' : 'Add a team number'}
				required
			/>
			<Button variant="secondary" type="submit">{teams.length === 0 ? 'Compare' : 'Add'}</Button>
		</form>
	{/if}
</div>

{#if suggestions.length > 0 && !full}
	<p class="suggest">
		{teams.length === 0 ? 'Top teams this season:' : 'Close in OPR:'}
		{#each suggestions as team, index (team.number)}
			<a href={compareHref([...numbers, team.number])} data-sveltekit-noscroll
				><b>{team.number}</b>{team.name ? ` ${team.name}` : ''}</a
			>{index < suggestions.length - 1 ? ', ' : ''}
		{/each}
		{#if teams.length === 0 && suggestions.length > 1}
			<span class="all">
				or <a href={compareHref(suggestions.map((team) => team.number))}
					>compare all {suggestions.length}</a
				>
			</span>
		{/if}
	</p>
{/if}

<style>
	.picker {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.chosen {
		display: contents;
		list-style: none;
	}

	li {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		font-size: 14px;
	}

	.team {
		max-width: 260px;
		overflow: hidden;
		padding: 6px 4px 6px 10px;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.team:hover {
		text-decoration: underline;
	}

	.team b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.remove {
		padding: 6px 10px 6px 6px;
		color: var(--text-3);
		text-decoration: none;
	}

	.remove:hover {
		color: var(--text);
	}

	.add {
		display: flex;
		gap: 8px;
	}

	.add input {
		width: 240px;
		padding: 7px 10px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
		line-height: 1.4;
	}

	.add input:hover {
		border-color: var(--text-3);
	}

	.suggest {
		font-size: 13px;
		color: var(--text-2);
	}

	.suggest a {
		color: var(--text);
		text-decoration: none;
	}

	.suggest a:hover {
		text-decoration: underline;
	}

	.all a {
		text-decoration: underline;
	}

	.suggest b {
		font-weight: 600;
	}

	@media (max-width: 600px) {
		.add {
			flex: 1 1 100%;
		}

		.add input {
			flex: 1;
			width: auto;
			min-width: 0;
		}
	}
</style>
