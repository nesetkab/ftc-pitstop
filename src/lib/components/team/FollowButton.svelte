<script lang="ts">
	import Button from '#lib/ui/Button.svelte';
	import { follows, syncFollows, toggleFollow } from '#lib/components/follow/follow.svelte.ts';

	interface Props {
		number: number;
	}

	let { number }: Props = $props();

	const following = $derived(follows.teams.includes(number));

	$effect(() => syncFollows());
</script>

<Button variant="secondary" onclick={() => toggleFollow(number)}>
	{following ? 'Following' : 'Follow'}
</Button>
