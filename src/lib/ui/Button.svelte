<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import Icon, { type IconName } from './Icon.svelte';

	type Variant = 'primary' | 'secondary';
	type LinkProps = HTMLAnchorAttributes & { href: string };
	type ButtonProps = HTMLButtonAttributes & { href?: undefined };
	type Props = (LinkProps | ButtonProps) & {
		variant?: Variant;
		icon?: IconName;
		iconEnd?: IconName;
		children: Snippet;
	};

	let { variant = 'primary', icon, iconEnd, children, class: className, ...rest }: Props = $props();
</script>

{#snippet content()}
	{#if icon}<Icon name={icon} size={14} />{/if}
	{@render children()}
	{#if iconEnd}<Icon name={iconEnd} size={14} />{/if}
{/snippet}

{#if rest.href !== undefined}
	<a class={['btn', variant, className]} {...rest as HTMLAnchorAttributes}>{@render content()}</a>
{:else}
	<button class={['btn', variant, className]} type="button" {...rest as HTMLButtonAttributes}>
		{@render content()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: var(--control-h);
		padding: 8px 12px;
		border: 1px solid var(--text);
		border-radius: var(--radius-control);
		background: var(--text);
		color: var(--bg);
		font: 500 13px/1 var(--font);
		text-decoration: none;
		white-space: nowrap;
	}

	.primary:hover {
		border-color: var(--text-2);
		background: var(--text-2);
	}

	.secondary {
		border-color: var(--line-2);
		background: transparent;
		color: var(--text);
	}

	.secondary:hover {
		background: var(--surface);
	}

	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.primary:disabled:hover {
		border-color: var(--text);
		background: var(--text);
	}

	.secondary:disabled:hover {
		background: transparent;
	}

	@media (pointer: coarse) {
		.btn {
			min-height: 40px;
		}
	}
</style>
