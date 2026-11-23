<script lang="ts">
	import Tabs, { type Tab } from '#lib/ui/Tabs.svelte';

	const sections: Tab[] = [
		{ href: '/events', label: 'All events' },
		{ href: '/events/strength', label: 'Strength' },
		{ href: '/advancement', label: 'Advancement' },
		{ href: '/regions', label: 'Regions' }
	];
</script>

<Tabs tabs={sections} label="Event pages" />
