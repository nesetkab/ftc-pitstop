<script lang="ts">
	interface Props {
		width?: string;
		height?: string;
		radius?: string;
	}

	let { width = '100%', height = '14px', radius }: Props = $props();
</script>

<span class="sk" style:width style:height style:border-radius={radius} aria-hidden="true"></span>

<style>
	.sk {
		--wait: var(--sk-delay, 0.15s);
		display: block;
		max-width: 100%;
		border-radius: var(--radius-chip);
		background: var(--line);
		animation:
			sk-in 0.2s var(--wait) backwards,
			sk-pulse 1.4s calc(var(--wait) + 0.2s) ease-in-out infinite;
	}

	@keyframes sk-in {
		from {
			opacity: 0;
		}
	}

	@keyframes sk-pulse {
		50% {
			opacity: 0.5;
		}
	}
</style>
