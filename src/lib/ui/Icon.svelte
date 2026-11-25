<script lang="ts" module>
	export type IconName = 'search' | 'team' | 'event' | 'recent' | 'close' | 'enter';
</script>

<script lang="ts">
	interface Props {
		name: IconName;
		size?: number;
	}

	let { name, size = 16 }: Props = $props();
</script>

<svg
	class="icon"
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#if name === 'search'}
		<circle cx="7" cy="7" r="4.5" />
		<path d="M10.5 10.5 13.5 13.5" />
	{:else if name === 'team'}
		<path d="M6.5 2.5 5 13.5M11 2.5 9.5 13.5M3 6h10.5M2.5 10H13" />
	{:else if name === 'event'}
		<rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
		<path d="M2.5 6.75h11M5.5 2v3M10.5 2v3" />
	{:else if name === 'recent'}
		<circle cx="8" cy="8" r="5.5" />
		<path d="M8 5v3l2 1.5" />
	{:else if name === 'close'}
		<path d="M4 4l8 8M12 4l-8 8" />
	{:else if name === 'enter'}
		<path d="M12.5 3.5v3.5a2 2 0 0 1-2 2h-7" />
		<path d="M6 6.5 3.5 9 6 11.5" />
	{/if}
</svg>

<style>
	.icon {
		flex: none;
		display: block;
	}
</style>
