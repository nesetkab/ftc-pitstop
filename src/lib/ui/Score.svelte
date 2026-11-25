<script lang="ts">
	interface Props {
		left: number | string;
		right: number | string;
		winner?: 'left' | 'right' | 'red' | 'blue' | 'tie' | null;
	}

	let { left, right, winner = null }: Props = $props();

	const leftWon = $derived(winner === 'left' || winner === 'red');
	const rightWon = $derived(winner === 'right' || winner === 'blue');
</script>

<span class="score"
	><span class={['side', 'left', { won: leftWon }]}>{left}</span><span class="dash">–</span><span
		class={['side', 'right', { won: rightWon }]}>{right}</span
	></span
>

<style>
	.score {
		display: inline-flex;
		align-items: baseline;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.side {
		min-width: 3ch;
		color: var(--text-2);
	}

	.left {
		text-align: right;
	}

	.right {
		text-align: left;
	}

	.dash {
		padding-inline: 2px;
		color: var(--text-3);
	}

	.won {
		color: var(--text);
		font-weight: 600;
	}
</style>
