<script lang="ts" module>
	export type IconName =
		| 'search'
		| 'team'
		| 'event'
		| 'place'
		| 'recent'
		| 'close'
		| 'enter'
		| 'sun'
		| 'moon'
		| 'system'
		| 'star'
		| 'star-filled'
		| 'compare'
		| 'tv'
		| 'video'
		| 'download'
		| 'print'
		| 'plus'
		| 'info'
		| 'refresh'
		| 'prev'
		| 'next'
		| 'list'
		| 'battery'
		| 'check'
		| 'board';
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
	{:else if name === 'place'}
		<path d="M8 14s4.5-4.2 4.5-7.75a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14z" />
		<circle cx="8" cy="6.25" r="1.5" />
	{:else if name === 'recent'}
		<circle cx="8" cy="8" r="5.5" />
		<path d="M8 5v3l2 1.5" />
	{:else if name === 'close'}
		<path d="M4 4l8 8M12 4l-8 8" />
	{:else if name === 'enter'}
		<path d="M12.5 3.5v3.5a2 2 0 0 1-2 2h-7" />
		<path d="M6 6.5 3.5 9 6 11.5" />
	{:else if name === 'sun'}
		<circle cx="8" cy="8" r="2.75" />
		<path
			d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65l1.05-1.05"
		/>
	{:else if name === 'moon'}
		<path d="M13.25 9.5A5.5 5.5 0 1 1 6.5 2.75a4.5 4.5 0 0 0 6.75 6.75z" />
	{:else if name === 'system'}
		<rect x="2" y="2.75" width="12" height="8.5" rx="1.5" />
		<path d="M5.5 13.75h5M8 11.25v2.5" />
	{:else if name === 'star' || name === 'star-filled'}
		<path
			d="M8 2.25l1.75 3.6 3.95.55-2.85 2.75.7 3.9L8 11.2l-3.55 1.85.7-3.9L2.3 6.4l3.95-.55z"
			fill={name === 'star-filled' ? 'currentColor' : 'none'}
		/>
	{:else if name === 'compare'}
		<path
			d="M2.75 5.25h10.5M10.5 2.5l2.75 2.75L10.5 8M13.25 10.75H2.75M5.5 8l-2.75 2.75L5.5 13.5"
		/>
	{:else if name === 'tv'}
		<rect x="1.75" y="2.75" width="12.5" height="8.75" rx="1.5" />
		<path d="M5.5 14h5" />
	{:else if name === 'video'}
		<rect x="1.75" y="3.25" width="12.5" height="9.5" rx="2" />
		<path d="M6.75 6v4l3.5-2z" />
	{:else if name === 'download'}
		<path d="M8 2.5v8M4.75 7.25 8 10.5l3.25-3.25M3 13.5h10" />
	{:else if name === 'print'}
		<path d="M4.5 6V2.5h7V6" />
		<rect x="2" y="6" width="12" height="5.5" rx="1.25" />
		<path d="M4.5 9.5h7v4h-7z" />
	{:else if name === 'plus'}
		<path d="M8 3v10M3 8h10" />
	{:else if name === 'info'}
		<circle cx="8" cy="8" r="5.75" />
		<path d="M8 7.25v3.75M8 5h.01" />
	{:else if name === 'refresh'}
		<path d="M13.25 8a5.25 5.25 0 1 1-1.55-3.7" />
		<path d="M13.25 2.5v3h-3" />
	{:else if name === 'prev'}
		<path d="M10 3.5 5.5 8l4.5 4.5" />
	{:else if name === 'next'}
		<path d="M6 3.5 10.5 8 6 12.5" />
	{:else if name === 'list'}
		<path d="M6.5 4h7M6.5 8h7M6.5 12h7M2.75 4h.5M2.75 8h.5M2.75 12h.5" />
	{:else if name === 'battery'}
		<rect x="1.75" y="4.5" width="11" height="7" rx="1.5" />
		<path d="M14.25 7v2M4.25 7v2M6.5 7v2" />
	{:else if name === 'check'}
		<rect x="2.5" y="2.5" width="11" height="11" rx="2" />
		<path d="M5.25 8.25 7 10l3.75-4" />
	{:else if name === 'board'}
		<rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.5" />
		<path d="M5 11c1.5-4 4.5-2 6-6M9.5 5H11v1.5" />
	{/if}
</svg>

<style>
	.icon {
		flex: none;
		display: block;
	}
</style>
