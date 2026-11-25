<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { reduced } from './motion.ts';

	interface Props {
		value: number | null | undefined;
		format: (value: number | null) => string;
		duration?: number;
	}

	let { value, format, duration = 400 }: Props = $props();

	const tween = new Tween(
		untrack(() => value ?? 0),
		{ easing: cubicOut }
	);
	let known = untrack(() => value != null);

	$effect.pre(() => {
		if (value == null) {
			known = false;
			return;
		}
		if (value === tween.target) return;
		tween.set(value, { duration: known && !reduced() ? duration : 0 });
		known = true;
	});
</script>

{format(value == null ? null : tween.current)}
