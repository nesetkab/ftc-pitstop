<script lang="ts">
	import '@fontsource-variable/hanken-grotesk';
	import '#lib/styles/tokens.css';
	import '#lib/styles/table.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

{@render children()}
