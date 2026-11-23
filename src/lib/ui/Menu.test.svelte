<script lang="ts">
	import Menu from './Menu.svelte';
</script>

<Menu label="Pit">
	{#snippet children(close)}
		<a href="#tv" onclick={close}>TV display</a>
		<a href="#phone">Phone view</a>
	{/snippet}
</Menu>
<button type="button">Outside</button>
