<script lang="ts">
	import '#lib/components/tools/controls.css';
	import { toggleFollow } from '#lib/components/follow/follow.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import { searchApi } from '#lib/ui/search-results.ts';
	import type { SearchFn } from '#lib/ui/search.svelte.ts';
	import { teamHits, type TeamHit } from './finder.ts';

	interface Props {
		search?: SearchFn;
		delay?: number;
		onfollow?: (team: number) => void;
	}

	let { search = searchApi, delay = 200, onfollow }: Props = $props();

	const id = $props.id();
	let query = $state('');
	let hits = $state<TeamHit[]>([]);
	let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');

	$effect(() => {
		const trimmed = query.trim();
		const find = search;
		if (!trimmed) {
			hits = [];
			status = 'idle';
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			status = 'loading';
			try {
				const found = await find(trimmed, controller.signal);
				if (controller.signal.aborted) return;
				hits = teamHits(found);
				status = 'done';
			} catch {
				if (controller.signal.aborted) return;
				hits = [];
				status = 'error';
			}
		}, delay);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	function follow(team: number) {
		toggleFollow(team);
		onfollow?.(team);
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (hits[0]) follow(hits[0].number);
	}
</script>

<form class="finder" onsubmit={submit} role="search" aria-label="Follow a team">
	<label class="visually-hidden" for="{id}-query">Team number or name</label>
	<input
		id="{id}-query"
		class="ctl-input"
		type="search"
		autocomplete="off"
		enterkeyhint="go"
		placeholder="Follow a team by number or name"
		bind:value={query}
	/>
	{#if hits.length > 0}
		<ul aria-label="Teams">
			{#each hits as hit (hit.number)}
				<li>
					<a href="/teams/{hit.number}">
						<b>{hit.number}</b>
						<span class="name">{hit.name}</span>
						{#if hit.place}<span class="faint">{hit.place}</span>{/if}
					</a>
					<Button
						variant="secondary"
						aria-label="Follow {hit.number}"
						onclick={() => follow(hit.number)}
					>
						Follow
					</Button>
				</li>
			{/each}
		</ul>
	{:else if status === 'done'}
		<p class="note" role="status">No teams match "{query.trim()}".</p>
	{:else if status === 'error'}
		<p class="note" role="status">Search isn't working right now. Try again in a moment.</p>
	{/if}
</form>

<style>
	.finder {
		display: grid;
		gap: 10px;
		max-width: 560px;
	}

	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
	}

	a {
		display: flex;
		flex: 1;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-decoration: none;
	}

	a:hover .name {
		text-decoration: underline;
	}

	b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.name,
	.faint {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.faint {
		flex: 0 1 auto;
		font-size: 13px;
	}

	@media (max-width: 480px) {
		.faint {
			display: none;
		}
	}
</style>
