<script lang="ts">
	import { integer } from '#lib/format/number.ts';
	import { PART_LABELS } from '#lib/game/biobuzz.ts';
	import Bars from '#lib/ui/Bars.svelte';
	import type { PointAverages } from './averages.ts';

	interface Props {
		averages: PointAverages;
	}

	let { averages }: Props = $props();

	const items = $derived(
		[
			{ label: PART_LABELS.hive, value: averages.hive },
			{ label: PART_LABELS.auto, value: averages.auto },
			{ label: PART_LABELS.park, value: averages.park },
			{ label: PART_LABELS.garden, value: averages.garden },
			{ label: PART_LABELS.flower, value: averages.flower }
		].sort((a, b) => b.value - a.value)
	);
</script>

<Bars {items} />
<p class="note">
	From {integer(averages.scores)} alliance scores in {integer(averages.matches)}
	{averages.matches === 1 ? 'match' : 'matches'}.
</p>
