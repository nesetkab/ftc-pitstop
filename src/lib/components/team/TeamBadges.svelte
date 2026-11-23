<script lang="ts">
	import type BadgePanelComponent from './BadgePanel.svelte';

	interface Props {
		number: number;
		name: string;
	}

	let { number, name }: Props = $props();

	let open = $state(false);
	let BadgePanel = $state<typeof BadgePanelComponent>();
	let loading: Promise<void> | undefined;

	$effect(() => {
		if (!open) return;
		loading ??= import('./BadgePanel.svelte').then((module) => {
			BadgePanel = module.default;
		});
	});
</script>

<details class="badges" bind:open>
	<summary>Badges for a team website or README</summary>
	{#if open && BadgePanel}
		<BadgePanel {number} {name} />
	{/if}
</details>

<style>
	.badges {
		max-width: 720px;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}

	summary {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 0;
		color: var(--text-2);
		font-size: 14px;
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary::before {
		content: '';
		width: 6px;
		height: 6px;
		margin: 0 2px;
		border-right: 1.5px solid var(--text-3);
		border-bottom: 1.5px solid var(--text-3);
		transform: rotate(-45deg);
		transition: transform 0.15s;
	}

	.badges[open] summary::before {
		transform: rotate(45deg);
	}

	summary:hover {
		color: var(--text);
	}
</style>
