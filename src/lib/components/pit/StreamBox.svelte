<script lang="ts">
	import { eventStream } from '#lib/stream.ts';
	import type { Event } from '#lib/types.ts';
	import StreamPlayer from './StreamPlayer.svelte';

	let { event }: { event: Event } = $props();
</script>

<div class="watch">
	<h2 class="visually-hidden">Live stream</h2>
	<div class="fit">
		<StreamPlayer code={event.code} listed={eventStream(event)} />
	</div>
</div>

<style>
	.watch {
		display: grid;
		grid-template: minmax(0, 1fr) / minmax(0, 1fr);
		min-height: 0;
	}

	.fit {
		min-height: 0;
		container-type: size;
	}

	/* Sizes the 16:9 video so the link box still fits under it. */
	.fit :global(.stream) {
		justify-items: center;
	}

	.fit :global(.frame) {
		width: min(100%, calc((100cqh - 3.2em) * 16 / 9));
	}

	.fit :global(.bar) {
		justify-self: stretch;
	}
</style>
