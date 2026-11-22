<script lang="ts" generics="T extends string">
	interface Option {
		value: T;
		label: string;
		href?: string;
	}

	interface Props {
		label: string;
		options: readonly Option[];
		value: T;
		onselect?: (value: T) => void;
	}

	let { label, options, value, onselect }: Props = $props();

	const links = $derived(options.every((option) => option.href !== undefined));
</script>

{#if links}
	<nav class="seg" aria-label={label}>
		{#each options as option (option.value)}
			<a
				href={option.href}
				aria-current={option.value === value ? 'page' : undefined}
				data-sveltekit-noscroll>{option.label}</a
			>
		{/each}
	</nav>
{:else}
	<div class="seg" role="group" aria-label={label}>
		{#each options as option (option.value)}
			<button
				type="button"
				aria-pressed={option.value === value}
				onclick={() => onselect?.(option.value)}
			>
				{option.label}
			</button>
		{/each}
	</div>
{/if}

<style>
	.seg {
		display: inline-flex;
		flex: none;
		max-width: 100%;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		overflow: hidden;
	}

	button,
	a {
		display: inline-flex;
		align-items: center;
		min-height: calc(var(--control-h) - 2px);
		padding: 0 12px;
		border: 0;
		background: transparent;
		color: var(--text-2);
		font: 500 13px/1 var(--font);
		text-decoration: none;
		white-space: nowrap;
	}

	button + button,
	a + a {
		border-left: 1px solid var(--line-2);
	}

	button:hover,
	a:hover {
		color: var(--text);
	}

	button[aria-pressed='true'],
	a[aria-current='page'] {
		background: var(--surface);
		color: var(--text);
	}

	button:focus-visible,
	a:focus-visible {
		outline-offset: -2px;
	}

	@media (max-width: 760px) {
		button,
		a {
			padding: 0 9px;
		}
	}

	@media (pointer: coarse) {
		button,
		a {
			min-height: 40px;
		}
	}
</style>
