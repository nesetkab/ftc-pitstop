<script lang="ts">
	import Menu from '#lib/ui/Menu.svelte';

	interface Props {
		number: number;
	}

	let { number }: Props = $props();
</script>

<Menu label="Pit screens">
	{#snippet children(close)}
		<ul>
			<li>
				<a href="/{number}/tv" onclick={close}>
					<span class="name">TV display</span>
					<span class="about">Full screen for the TV in your pit</span>
				</a>
			</li>
			<li>
				<a href="/{number}" onclick={close}>
					<span class="name">Phone view</span>
					<span class="about">Next match and alerts while you queue</span>
				</a>
			</li>
		</ul>
	{/snippet}
</Menu>

<style>
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	a {
		display: grid;
		gap: 2px;
		padding: 8px 14px;
		color: var(--text);
		text-decoration: none;
	}

	a:hover {
		background: var(--surface);
	}

	.name {
		font-size: 14px;
		font-weight: 500;
	}

	.about {
		font-size: 13px;
		color: var(--text-2);
	}

	@media (pointer: coarse) {
		a {
			padding-block: 10px;
		}
	}
</style>
