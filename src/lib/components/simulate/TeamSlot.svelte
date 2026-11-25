<script lang="ts">
	import type { SearchFn } from '#lib/ui/search.svelte.ts';
	import TeamInput from '#lib/ui/TeamInput.svelte';
	import type { Color } from './simulate.ts';

	interface Props {
		field: string;
		label: string;
		color: Color;
		team: { number: number; name: string | null } | null;
		removeHref: string | null;
		onpick: (number: number) => void;
		search?: SearchFn;
		delay?: number;
	}

	let { field, label, color, team, removeHref, onpick, search, delay }: Props = $props();

	const id = $props.id();
	let query = $derived(team ? String(team.number) : '');
	let editing = $state(false);
</script>

<div class="slot">
	<label class={['label', color]} for="{id}-input">{label}</label>
	<div class="row">
		<TeamInput
			id="{id}-input"
			name={field}
			placeholder="Number or name"
			listLabel="Teams matching {label}"
			enterkeyhint="go"
			{search}
			{delay}
			bind:value={query}
			oninput={() => (editing = true)}
			onpick={(number) => {
				editing = false;
				onpick(number);
			}}
		/>
		{#if removeHref && team}
			<a
				class="remove"
				href={removeHref}
				aria-label="Remove {team.number} from {label}"
				data-sveltekit-noscroll>×</a
			>
		{/if}
	</div>
	{#if team && !editing}
		<a class="name" href="/teams/{team.number}">{team.name ?? `Team ${team.number}`}</a>
	{/if}
</div>

<style>
	.slot {
		position: relative;
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	.label {
		font-size: 12.5px;
		font-weight: 500;
	}

	.label.red {
		color: var(--red);
	}

	.label.blue {
		color: var(--blue);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.remove {
		padding: 4px 8px;
		color: var(--text-3);
		font-size: 18px;
		line-height: 1;
		text-decoration: none;
	}

	.remove:hover {
		color: var(--text);
	}

	.name {
		overflow: hidden;
		font-size: 13px;
		color: var(--text-2);
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name:hover {
		color: var(--text);
		text-decoration: underline;
	}
</style>
