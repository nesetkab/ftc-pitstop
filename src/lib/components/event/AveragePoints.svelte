<script lang="ts">
	import { integer } from '#lib/format/number.ts';
	import Bars from '#lib/ui/Bars.svelte';
	import type { PointAverages } from './averages.ts';

	interface Props {
		averages: PointAverages;
	}

	let { averages }: Props = $props();

	const items = $derived(
		[
			{ label: 'Hive', value: averages.hive },
			{ label: 'Auto', value: averages.auto },
			{ label: 'Park', value: averages.park },
			{ label: 'Garden', value: averages.garden },
			{ label: 'Flowers', value: averages.flower }
		].sort((a, b) => b.value - a.value)
	);
</script>

<Bars {items} />
<p class="note">
	From {integer(averages.scores)} alliance scores in {integer(averages.matches)}
	{averages.matches === 1 ? 'match' : 'matches'}.
</p>
