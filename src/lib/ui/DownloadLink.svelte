<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		href: string;
		label?: string;
	}

	let { href, label = 'Download CSV' }: Props = $props();
</script>

<a class="download" {href} download><Icon name="download" size={14} />{label}</a>

<style>
	.download {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	@media (pointer: coarse) {
		.download {
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
