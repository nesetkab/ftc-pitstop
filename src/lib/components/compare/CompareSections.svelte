<script lang="ts">
	import { sidesFrom, simulateHref } from '#lib/components/simulate/simulate.ts';
	import Tabs, { type Tab } from '#lib/ui/Tabs.svelte';
	import { compareHref } from './compare.ts';

	interface Props {
		teams?: number[];
	}

	let { teams = [] }: Props = $props();

	const sections: Tab[] = $derived([
		{ href: compareHref(teams), label: 'Compare' },
		{ href: simulateHref(sidesFrom(teams.slice(0, 2), teams.slice(2))), label: 'Simulate' }
	]);
</script>

<Tabs tabs={sections} label="Team tools" />
