<script lang="ts">
	import type { Component } from 'svelte';
	import Sample from './components/sample.svelte';
	import Sample2 from './components/sample2.svelte';

	let components = new Map<string, Component>();
	components.set('sample', Sample);
	components.set('sample2', Sample2);
</script>

<div class="w-screen min-h-full flex-grow bg-amber-50 flex flex-row">
	{#each components as comp (comp)}
		<svelte:component this={components.get(comp[0])} />
	{/each}
</div>
