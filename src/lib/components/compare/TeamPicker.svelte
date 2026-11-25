<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '#lib/ui/Button.svelte';
	import type { SearchFn } from '#lib/ui/search.svelte.ts';
	import TeamInput from '#lib/ui/TeamInput.svelte';
	import { compareHref, MAX_COMPARE, type CompareTeam } from './compare.ts';

	interface Props {
		teams: CompareTeam[];
		suggestions: { number: number; name: string | null }[];
		search?: SearchFn;
		delay?: number;
	}

	let { teams, suggestions, search, delay }: Props = $props();

	let draft = $state('');

	function pick(number: number) {
		draft = '';
		if (numbers.includes(number)) return;
		goto(compareHref([...numbers, number]), { reset: false });
	}

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
						data-sveltekit-reset="false">×</a
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
			<label for="{id}-add" class="visually-hidden">Team number or name to add</label>
			<TeamInput
				id="{id}-add"
				name="add"
				class="field"
				maxlength={30}
				placeholder={teams.length === 0
					? 'Numbers or a name, like 19666 7759'
					: 'Add a team number or name'}
				required
				{search}
				{delay}
				bind:value={draft}
				onpick={pick}
			/>
			<Button variant="secondary" type="submit">{teams.length === 0 ? 'Compare' : 'Add'}</Button>
		</form>
	{/if}
</div>

{#if suggestions.length > 0 && !full}
	<p class="suggest">
		{teams.length === 0 ? 'Top teams this season:' : 'Close in OPR:'}
		{#each suggestions as team, index (team.number)}
			<a href={compareHref([...numbers, team.number])} data-sveltekit-reset="false"
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

	.add :global(.field) {
		width: 260px;
		padding: 7px 10px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
		line-height: 1.4;
	}

	.add :global(.field:hover) {
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

		.add :global(.field) {
			flex: 1;
			width: 100%;
			min-width: 0;
		}
	}

	@media (pointer: coarse) {
		.team {
			line-height: 28px;
		}

		.remove {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 40px;
			min-height: 40px;
			padding: 0;
		}

		.add :global(.field) {
			min-height: 40px;
		}

		.suggest {
			line-height: 40px;
		}

		.suggest a {
			display: inline-block;
			padding-block: 10px;
			line-height: 20px;
		}
	}
	@media (pointer: coarse), (max-width: 600px) {
		.add :global(.field) {
			font-size: 16px;
		}
	}
</style>
