<script lang="ts">
	import { time } from '#lib/format/time.ts';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import {
		finalsStatus,
		type BracketMatchView,
		type BracketView,
		type SlotView
	} from './bracket.ts';

	interface Props {
		code: string;
		bracket: BracketView;
		timezone: string;
		followed?: ReadonlySet<number>;
	}

	let { code, bracket, timezone, followed = new Set() }: Props = $props();

	const sections = $derived(
		[
			{ id: 'upper', title: 'Upper bracket', rounds: bracket.upper },
			{ id: 'lower', title: 'Lower bracket', rounds: bracket.lower }
		].filter((section) => section.rounds.length > 0)
	);

	const status = $derived(finalsStatus(bracket));

	function href(key: string | null) {
		return key ? `/events/${code}/matches/${key}` : undefined;
	}
</script>

{#snippet slot(side: SlotView, color: 'red' | 'blue', match: BracketMatchView)}
	<div class={['slot', color, { won: side.won, lost: match.played && !side.won }]}>
		<span class="visually-hidden"
			>{color === 'red' ? 'Red' : 'Blue'}{side.seed === null ? '' : `, alliance ${side.seed}`}</span
		>
		<span class="seed" aria-hidden="true">{side.seed === null ? '' : `A${side.seed}`}</span>
		<span class="teams">
			{#if side.teams.length > 0}
				{#each side.teams as team (team)}
					<TeamChip number={team} alliance={color} me={followed.has(team)} />
				{/each}
			{:else}
				<span class="source">{side.source}</span>
			{/if}
		</span>
		<span class="score"
			>{side.score ?? ''}{#if side.won}<span class="visually-hidden">, won</span>{/if}</span
		>
	</div>
{/snippet}

{#snippet box(match: BracketMatchView)}
	<li class="box" data-series={match.series}>
		<div class="head">
			<svelte:element this={match.key ? 'a' : 'span'} class="label" href={href(match.key)}>
				{match.label}
			</svelte:element>
			{#if !match.played && match.time !== null}
				<span class="when">{time(match.time, timezone)}</span>
			{/if}
		</div>
		{@render slot(match.red, 'red', match)}
		{@render slot(match.blue, 'blue', match)}
	</li>
{/snippet}

<div class={['bracket', `size-${bracket.size}`]} aria-label="Playoff bracket" role="group">
	{#each sections as section (section.id)}
		<section class={['part', section.id]} aria-label={section.title}>
			<h3 class="part-title">{section.title}</h3>
			<div class="rounds">
				{#each section.rounds as round, index (index)}
					<div class="round">
						<h4 class="round-title">Round {round[0].round}</h4>
						<ul class="round-matches">
							{#each round as match (match.series)}
								{@render box(match)}
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</section>
	{/each}

	<section class="part finals" aria-label="Finals">
		<h3 class="part-title">Finals</h3>
		<table class="series">
			<thead>
				<tr>
					<th scope="col"><span class="visually-hidden">Alliance</span></th>
					{#each bracket.finals.games as game (game.label)}
						<th scope="col" class="game">
							<svelte:element this={game.key ? 'a' : 'span'} href={href(game.key)}>
								{game.label}
							</svelte:element>
							{#if game.ifNeeded}
								<span class="note">If needed</span>
							{:else if !game.played && game.time !== null}
								<span class="note">{time(game.time, timezone)}</span>
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each bracket.finals.alliances as side, index (index)}
					<tr
						class={{
							champion: side.champion,
							finalist: bracket.champion !== null && !side.champion
						}}
					>
						<th scope="row" class="side">
							<span class="side-inner">
								<span class="seed">
									{#if side.seed !== null}
										<span class="visually-hidden">Alliance {side.seed}</span>
										<span aria-hidden="true">A{side.seed}</span>
									{/if}
								</span>
								<span class="teams">
									{#if side.teams.length > 0}
										{#each side.teams as team (team)}
											<TeamChip number={team} me={followed.has(team)} />
										{/each}
									{:else}
										<span class="source">{side.source}</span>
									{/if}
								</span>
							</span>
						</th>
						{#each bracket.finals.games as game (game.label)}
							<td
								class={[
									'game-score',
									{
										won: game.winner === index,
										lost: game.winner !== null && game.winner !== index
									}
								]}
							>
								{game.scores[index] ?? ''}{#if game.winner === index}<span class="visually-hidden"
										>, won</span
									>{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
		{#if status}
			<p class="result">{status}</p>
		{/if}
	</section>
</div>

<style>
	.bracket {
		display: grid;
		grid-template-columns: max-content max-content;
		grid-template-areas:
			'upper finals'
			'lower finals';
		gap: 28px 40px;
		align-items: center;
		overflow-x: auto;
		padding-bottom: 4px;
	}

	.size-2 {
		grid-template-columns: minmax(0, max-content);
		grid-template-areas: 'finals';
	}

	.part {
		display: grid;
		gap: 10px;
		align-content: start;
		min-width: 0;
	}

	.upper {
		grid-area: upper;
	}

	.lower {
		grid-area: lower;
	}

	.finals {
		grid-area: finals;
		align-self: center;
	}

	.part-title {
		font-size: 15px;
		font-weight: 600;
	}

	.rounds {
		display: flex;
		gap: 20px;
		align-items: stretch;
	}

	.round {
		display: grid;
		grid-template-rows: auto 1fr;
		gap: 6px;
	}

	.round-title {
		font-size: 12.5px;
		font-weight: 400;
		line-height: inherit;
		letter-spacing: normal;
		color: var(--text-3);
	}

	.round-matches {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		justify-content: space-around;
		gap: 12px;
	}

	.box {
		display: grid;
		width: 216px;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	.head {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 10px 4px;
		font-size: 12.5px;
		color: var(--text-3);
	}

	.label {
		font-weight: 600;
		color: var(--text-2);
		text-decoration: none;
	}

	a.label:hover {
		color: var(--text);
		text-decoration: underline;
	}

	@media (pointer: coarse) {
		.box {
			position: relative;
		}

		a.label::after {
			content: '';
			position: absolute;
			inset: 0;
		}
	}

	.slot {
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr) auto;
		gap: 8px;
		align-items: center;
		padding: 5px 10px;
		border-top: 1px solid var(--line);
	}

	.slot.red {
		box-shadow: inset 3px 0 0 var(--red);
	}

	.slot.blue {
		box-shadow: inset 3px 0 0 var(--blue);
	}

	.slot:last-child {
		border-bottom-left-radius: calc(var(--radius-panel) - 1px);
	}

	.seed {
		font-size: 12.5px;
		color: var(--text-3);
		white-space: nowrap;
	}

	.teams {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		min-width: 0;
	}

	.source {
		font-size: 13px;
		color: var(--text-3);
	}

	.score {
		min-width: 28px;
		text-align: right;
		color: var(--text-2);
	}

	.won .score {
		color: var(--text);
		font-weight: 600;
	}

	.lost .teams {
		opacity: 0.6;
	}

	.series {
		justify-self: start;
		border-collapse: separate;
		border-spacing: 0;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	.series th,
	.series td {
		padding: 7px 10px;
		border-top: 1px solid var(--line);
	}

	.series thead th {
		border-top: 0;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--text-3);
		text-align: right;
		white-space: nowrap;
		vertical-align: bottom;
	}

	.series thead a {
		font-weight: 600;
		color: var(--text-2);
		text-decoration: none;
	}

	.series thead a:hover {
		color: var(--text);
		text-decoration: underline;
	}

	.note {
		display: block;
		font-weight: 400;
	}

	.side {
		font-weight: 400;
		text-align: left;
	}

	.side-inner {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.game-score {
		min-width: 52px;
		text-align: right;
		color: var(--text-2);
	}

	.game-score.won {
		color: var(--text);
		font-weight: 600;
	}

	.champion .side .seed {
		color: var(--text);
		font-weight: 600;
	}

	.finalist .teams {
		opacity: 0.6;
	}

	.result {
		font-size: 14px;
		color: var(--text-2);
	}

	@media (max-width: 900px) {
		.bracket {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas:
				'upper'
				'lower'
				'finals';
			align-items: start;
			overflow-x: visible;
		}

		.rounds {
			overflow-x: auto;
			padding-bottom: 4px;
		}

		.finals {
			align-self: start;
			min-width: 0;
		}
	}

	@media (max-width: 600px) {
		.rounds {
			flex-direction: column;
			gap: 16px;
			overflow-x: visible;
		}

		.round-matches {
			gap: 10px;
		}

		.box {
			width: 100%;
		}
	}
</style>
