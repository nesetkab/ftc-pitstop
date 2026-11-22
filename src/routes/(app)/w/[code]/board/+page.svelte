<script lang="ts">
	import StrategyBoard from '#lib/components/tools/StrategyBoard.svelte';
	import { getWorkspace } from '#lib/workspace/workspace.svelte.ts';

	const workspace = getWorkspace();
</script>

<svelte:head>
	<title>Strategy board, team tools - PitStop</title>
</svelte:head>

<StrategyBoard
	boards={workspace.docs.boards}
	team={workspace.meta?.teamNumber ?? null}
	update={(change) => workspace.update('boards', change)}
	shareContext={{ from: workspace.code, team: workspace.meta?.teamNumber ?? null }}
/>
