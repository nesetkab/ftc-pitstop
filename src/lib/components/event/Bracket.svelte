<script lang="ts">
	import { time } from '#lib/format/time.ts';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import { SIZES, layoutBracket } from './bracket-layout.ts';
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

	const layout = $derived(layoutBracket(bracket));
	const status = $derived(finalsStatus(bracket));
	const gameWidth = SIZES.game;

	function href(key: string | null) {
		return key ? `/events/${code}/matches/${key}` : undefined;
	}

	function place(x: number, y: number) {
		return `left: ${x}px; top: ${y}px;`;
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

<div class="bracket" aria-label="Playoff bracket" role="group">
	<div class="scroll">
		<div
			class="canvas"
			style="width: {layout.width}px; height: {layout.height}px; --box: {layout.box}px; --box-h: {layout.boxHeight}px; --head: {SIZES.head}px; --row: {SIZES.row}px; --finals-head: {layout
				.finals.head}px; --game: {gameWidth}px;"
		>
			<svg
				class="lines"
				width={layout.width}
				height={layout.height}
				viewBox="0 0 {layout.width} {layout.height}"
				aria-hidden="true"
			>
				{#each layout.lines as line (line.d)}
					<path d={line.d} class={{ done: line.done }} />
				{/each}
			</svg>

			{#each layout.sections as section (section.id)}
				<section class={['part', section.id]} aria-label={section.title}>
					<h3 class="part-title" style={place(0, section.y)}>{section.title}</h3>
					{#each section.rounds as round (round.round)}
						<div class="round">
							<h4 class="round-title" style={place(round.x, round.y)}>Round {round.round}</h4>
							<ul class="round-matches">
								{#each round.matches as { match, x, y } (match.series)}
									<li class="box" data-series={match.series} style={place(x, y)}>
										<div class="head">
											<svelte:element
												this={match.key ? 'a' : 'span'}
												class="label"
												href={href(match.key)}
											>
												{match.label}
											</svelte:element>
											{#if !match.played && match.time !== null}
												<span class="when">{time(match.time, timezone)}</span>
											{/if}
										</div>
										{@render slot(match.red, 'red', match)}
										{@render slot(match.blue, 'blue', match)}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</section>
			{/each}

			<section class="part finals" aria-label="Finals">
				<h3 class="part-title" style={place(layout.finals.x, layout.finals.titleY)}>Finals</h3>
				<table
					class="series"
					style="{place(layout.finals.x, layout.finals.y)} width: {layout.finals.width}px;"
				>
					<colgroup>
						<col />
						{#each bracket.finals.games as game (game.label)}
							<col class="game-col" />
						{/each}
					</colgroup>
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
										{game.scores[index] ?? ''}{#if game.winner === index}<span
												class="visually-hidden">, won</span
											>{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		</div>
	</div>
	{#if status}
		<p class="result">{status}</p>
	{/if}
</div>

<style>
	.bracket {
		display: grid;
		gap: 12px;
		min-width: 0;
	}

	.scroll {
		overflow-x: auto;
		scroll-snap-type: x proximity;
		padding-bottom: 6px;
	}

	.canvas {
		position: relative;
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	.lines {
		position: absolute;
		inset: 0;
		overflow: visible;
		pointer-events: none;
	}

	.lines path {
		fill: none;
		stroke: var(--line-2);
		stroke-width: 1.5;
	}

	.lines path.done {
		stroke: var(--text-3);
	}

	.part-title,
	.round-title,
	.box,
	.series {
		position: absolute;
	}

	.part-title {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		line-height: 22px;
		white-space: nowrap;
	}

	.round-title {
		margin: 0;
		font-size: 12.5px;
		font-weight: 400;
		line-height: 18px;
		letter-spacing: normal;
		color: var(--text-3);
		white-space: nowrap;
		scroll-snap-align: start;
	}

	.round-matches {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.box {
		display: grid;
		grid-template-rows: var(--head) var(--row) var(--row);
		width: var(--box);
		height: var(--box-h);
		border-radius: var(--radius-panel);
		background: var(--bg);
		box-shadow: 0 0 0 1px var(--line);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 0 10px;
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
		padding: 0 10px;
		border-top: 1px solid var(--line);
	}

	.slot.red {
		box-shadow: inset 3px 0 0 var(--red);
	}

	.slot.blue {
		box-shadow: inset 3px 0 0 var(--blue);
		border-bottom-left-radius: var(--radius-panel);
	}

	.seed {
		font-size: 12.5px;
		color: var(--text-3);
		white-space: nowrap;
	}

	.teams {
		display: flex;
		gap: 4px;
		min-width: 0;
		overflow: hidden;
	}

	.source {
		font-size: 13px;
		color: var(--text-3);
		white-space: nowrap;
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
		table-layout: fixed;
		border-collapse: separate;
		border-spacing: 0;
		border-radius: var(--radius-panel);
		background: var(--bg);
		box-shadow: 0 0 0 1px var(--line);
	}

	.game-col {
		width: var(--game);
	}

	.series thead tr {
		height: var(--finals-head);
	}

	.series tbody tr {
		height: var(--row);
	}

	.series th,
	.series td {
		padding: 0 10px;
		border-top: 1px solid var(--line);
	}

	.series thead th {
		border-top: 0;
		font-size: 12.5px;
		font-weight: 500;
		line-height: 16px;
		color: var(--text-3);
		text-align: right;
		white-space: nowrap;
		vertical-align: middle;
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
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr);
		gap: 8px;
		align-items: center;
	}

	.game-score {
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
		margin: 0;
		font-size: 14px;
		color: var(--text-2);
	}
</style>
