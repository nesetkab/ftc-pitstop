<script lang="ts">
	import Segmented from './Segmented.svelte';
	import { readTheme, setTheme, theme, type Theme } from './theme.svelte.ts';

	const options: { value: Theme; label: string }[] = [
		{ value: 'system', label: 'System' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];

	$effect(() => {
		theme.current = readTheme();
	});
</script>

<Segmented label="Theme" {options} value={theme.current} onselect={setTheme} />
