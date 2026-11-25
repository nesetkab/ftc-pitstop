<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLParagraphElement> & {
		lead: string;
		rest?: string;
		size?: 'normal' | 'large';
	};

	let { lead, rest, size = 'normal', class: className, ...attrs }: Props = $props();
</script>

<p class={['lede', size, className]} {...attrs}>
	<mark>{lead}</mark>
	{#if rest}<span>{rest}</span>{/if}
</p>

<style>
	.lede {
		max-width: 44em;
		font-size: 18px;
		line-height: 1.45;
		text-wrap: pretty;
	}

	.large {
		max-width: 28em;
		font-size: 24px;
		line-height: 1.3;
		letter-spacing: -0.01em;
	}

	mark {
		padding: 0 3px;
		border-radius: 2px;
		background: var(--accent-wash);
		color: var(--text);
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}

	span {
		color: var(--text-2);
	}

	@media (max-width: 600px) {
		.lede {
			font-size: 16px;
		}

		.large {
			font-size: 20px;
		}
	}
</style>
