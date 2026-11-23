<script lang="ts">
	import Tabs, { type Tab } from '#lib/ui/Tabs.svelte';

	const sections: Tab[] = [
		{ href: '/events', label: 'All events' },
		{ href: '/events/strength', label: 'Strength' },
		{ href: '/advancement', label: 'Advancement' }
	];
</script>

<Tabs tabs={sections} label="Event pages" />
