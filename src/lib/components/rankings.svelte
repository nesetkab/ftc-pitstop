<script lang="ts">
	import type { Rankings, RankingTeam } from '$lib/types/rankings';
	import { ordinal } from '$lib/helpers/ordinal';
	let teams: RankingTeam[] = [
		{
			rank: 1,
			teamNum: 254,
			teamName: 'The Cheesy Poofs',
			wins: 10,
			ties: 0,
			losses: 2,
			sortOrder1: 2.45
		},
		{
			rank: 2,
			teamNum: 1114,
			teamName: 'Simbotics',
			wins: 9,
			ties: 1,
			losses: 2,
			sortOrder1: 2.31
		},
		{
			rank: 3,
			teamNum: 2056,
			teamName: 'OP Robotics',
			wins: 9,
			ties: 0,
			losses: 3,
			sortOrder1: 2.18
		},
		{ rank: 4, teamNum: 118, teamName: 'Robonauts', wins: 8, ties: 1, losses: 3, sortOrder1: 2.05 },
		{ rank: 5, teamNum: 33, teamName: 'Killer Bees', wins: 8, ties: 0, losses: 4, sortOrder1: 1.92 }
	];
</script>

<div class="min-h-full bg-bg-accent p-4 flex flex-col gap-2 flex-grow">
	<h1 class="text-2xl text-text font-bold">Rankings</h1>
	{#each teams as team}
		<div class="flex flex-row p-2 rounded-2xl gap-2 bg-bg">
			<div
				class="rounded-full content-center w-12 text-text px-2 pt-0.5 justify-center text-center"
			>
				{ordinal(team.rank)}
			</div>
			<div class="flex flex-col max-w-20 text-lg text-text">
				<h1 class="text-sm">{team.teamNum}</h1>
				<h1 class="-mt-1 truncate">{team.teamName}</h1>
			</div>
			<div class="flex flex-row gap-1 right-4 absolute rounded-2xl">
				<div class="rounded-full bg-green-300 px-2 pt-0.5 justify-center text-center">
					{team.wins}
				</div>
				<div class="rounded-full bg-yellow-300 px-2 pt-0.5 justify-center text-center">
					{team.ties}
				</div>
				<div class="rounded-full bg-red-300 px-2 pt-0.5 justify-center text-center">
					{team.losses}
				</div>
			</div>
		</div>
	{/each}
</div>
