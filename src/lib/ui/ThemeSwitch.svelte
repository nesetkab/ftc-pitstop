<script lang="ts">
	import { readTheme, setTheme, theme, type Theme } from './theme.svelte.ts';

	const options: { value: Theme; label: string }[] = [
		{ value: 'system', label: 'System' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];

	$effect(() => {
		theme.current = readTheme();
	});
</script>

<div class="seg" role="group" aria-label="Theme">
	{#each options as option (option.value)}
		<button
			type="button"
			aria-pressed={theme.current === option.value}
			onclick={() => setTheme(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>

<style>
	.seg {
		display: inline-flex;
		flex: none;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		overflow: hidden;
	}

	button {
		font: 500 13px/1 var(--font);
		color: var(--text-2);
		background: transparent;
		border: 0;
		padding: 7px 12px;
	}

	button + button {
		border-left: 1px solid var(--line-2);
	}

	button:hover {
		color: var(--text);
	}

	button[aria-pressed='true'] {
		background: var(--surface);
		color: var(--text);
	}

	button:focus-visible {
		outline-offset: -2px;
	}

	@media (max-width: 760px) {
		button {
			padding: 7px 9px;
		}
	}
</style>
