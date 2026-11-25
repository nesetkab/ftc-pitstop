<script lang="ts">
	import type { IconName } from './Icon.svelte';
	import Segmented from './Segmented.svelte';
	import { readTheme, setTheme, theme, type Theme } from './theme.svelte.ts';

	const options: { value: Theme; label: string; icon: IconName }[] = [
		{ value: 'system', label: 'System theme', icon: 'system' },
		{ value: 'light', label: 'Light theme', icon: 'sun' },
		{ value: 'dark', label: 'Dark theme', icon: 'moon' }
	];

	$effect(() => {
		theme.current = readTheme();
	});
</script>

<Segmented label="Theme" {options} value={theme.current} onselect={setTheme} />
