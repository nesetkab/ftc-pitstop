<script lang="ts">
	import { untrack } from 'svelte';
	import type { EventAnalysis } from '#lib/analysis/types.ts';
	import { delayText } from '#lib/components/pit/copy.ts';
	import { fixed } from '#lib/format/number.ts';
	import { pct } from '#lib/format/pct.ts';
	import { time, timeWithSeconds } from '#lib/format/time.ts';
	import { hasPlayoffs } from '#lib/game/event-types.ts';
	import type { ReplaySettings } from '#lib/game/replay.ts';
	import type { AllianceColor, EventBundle } from '#lib/types.ts';
	import PredictionCard from '#lib/ui/PredictionCard.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import Term from '#lib/ui/Term.svelte';
	import MatchStakes from './MatchStakes.svelte';
	import { matchHref, teamHref } from './matches.ts';
	import type { NowMatch, NowStatus, ResultTag } from './now.ts';
	import { NowSession } from './now.svelte.ts';
	import { matchStakes } from './stakes.ts';

	interface Props {
		bundle: EventBundle;
		analysis: EventAnalysis | null;
		replay?: ReplaySettings | null;
		followed?: ReadonlySet<number>;
		reload: () => unknown;
	}

	let { bundle, analysis, replay = null, followed = new Set(), reload }: Props = $props();

	const session = untrack(
		() => new NowSession({ bundle, analysis, replay, reload: () => reload() })
	);

	$effect(() => session.update(bundle, analysis));
	$effect(() => session.start());

	const view = $derived(session.view);
	const event = $derived(session.bundle.event);
	const code = $derived(event.code);
	const zone = $derived(event.timezone);
	const names = $derived(new Map(session.bundle.teams.map((team) => [team.number, team.name])));
	const featured = $derived(view.onField ?? view.upcoming[0] ?? null);
	const later = $derived(view.upcoming.filter((match) => match.key !== featured?.key));
	const delay = $derived(delayText(view.delaySeconds));
	const firstSignature = untrack(() => session.signature);
	const fresh = $derived(session.signature !== firstSignature);
	const updated = $derived(session.replay ? session.clock : session.feed.updatedAt);

	const stakesKey = $derived(
		featured && session.analysis && hasPlayoffs(event.type)
			? `${featured.key}:${session.signature}:${session.analysis.generatedAt}`
			: null
	);
	const stakes = $derived.by(() => {
		if (!stakesKey) return null;
		return untrack(() => {
			const match = session.bundle.matches.find((entry) => entry.key === featured?.key);
			const current = session.analysis;
			if (!match || !current) return null;
			return matchStakes({
				match,
				matches: session.bundle.matches,
				rankings: session.bundle.rankings,
				analysis: current
			});
		});
	});

	const STATUS: Record<NowStatus, string> = {
		playing: 'Playing now',
		'on-field': 'On the field',
		'on-deck': 'On deck',
		'now-queuing': 'Queuing now',
		'queuing-soon': 'Queuing soon'
	};

	const TAG: Record<ResultTag, string> = { upset: 'Upset', close: 'Close', tie: 'Tie' };

	const heading = $derived.by(() => {
		if (view.onField) return 'On the field';
		if (view.phase === 'upcoming' && view.qualsPlayed === 0) return 'First match';
		return 'Up next';
	});

	function when(match: NowMatch): string | null {
		if (match.started !== null) return `Started ${time(match.started, zone)}`;
		if (match.key === view.onField?.key) return null;
		if (match.expected !== null) return `~${time(match.expected, zone)}`;
		if (match.scheduled !== null) return time(match.scheduled, zone);
		return null;
	}

	function favorite(match: NowMatch) {
		const forecast = match.forecast;
		if (!forecast) return null;
		return forecast.red.win >= forecast.blue.win
			? { alliance: 'red' as const, label: 'Red', win: forecast.red.win }
			: { alliance: 'blue' as const, label: 'Blue', win: forecast.blue.win };
	}

	function side(match: NowMatch, color: AllianceColor) {
		return {
			teams: match[color].map((number) => ({ number, name: names.get(number) })),
			win: match.forecast?.[color].win ?? null,
			score: match.forecast?.[color].score ?? null
		};
	}

	function move(value: number | null): string {
		if (value === null) return '';
		if (value === 0) return '–';
		return value > 0 ? `↑${value}` : `↓${-value}`;
	}

	function moveLabel(value: number | null): string | undefined {
		if (value === null || value === 0) return value === 0 ? 'No change' : undefined;
		return value > 0 ? `Up ${value}` : `Down ${-value}`;
	}

	function upsetNote(chance: number | null, winner: AllianceColor | null): string | undefined {
		if (chance === null || winner === null) return undefined;
		return `${winner === 'red' ? 'Red' : 'Blue'} had a ${pct(chance)} chance to win`;
	}
</script>

{#snippet alliance(teams: number[], color: AllianceColor, pending: string | null)}
	<span class="chips">
		{#if teams.length === 0 && pending}
			<span class="pending">{pending}</span>
		{:else}
			{#each teams as team (team)}
				<TeamChip
					number={team}
					alliance={color}
					me={followed.has(team)}
					href={teamHref(team, code)}
				/>
			{/each}
		{/if}
	</span>
{/snippet}

<div class="now">
	<p class="status" role="status">
		<span class={['cue', { fresh }]} aria-hidden="true"></span>
		{#if session.replay}
			<span>Replay at {timeWithSeconds(session.clock, zone)}, {session.replay.speed}× speed</span>
		{:else if session.connection === 'offline'}
			<span>Offline. Showing the last update</span>
		{:else if session.connection === 'retrying'}
			<span>Reconnecting</span>
		{:else if updated !== null}
			<span>Checked {time(updated, zone)}</span>
		{/if}
		{#if delay}
			<span class="delay">{delay}</span>
		{/if}
	</p>

	<div class="layout">
		<div class="column">
			{#if view.phase === 'done'}
				<section class="block">
					<h2 class="sec-title">Event complete</h2>
					{#if view.champion}
						<p class="lead">
							Alliance {view.champion.seed} won:
							{#each view.champion.teams as team, index (team)}{index > 0 ? ', ' : ''}<a
									href={teamHref(team, code)}>{team}</a
								>{/each}.
						</p>
					{:else}
						<p class="muted">All matches are played.</p>
					{/if}
				</section>
			{:else if featured}
				<section class="block" aria-live="polite">
					<div class="head">
						<h2 class="sec-title">{heading}</h2>
						{#if when(featured)}
							<span class="time">{when(featured)}</span>
						{/if}
					</div>
					<p class="match">
						<a class="label" href={matchHref(code, featured)}>{featured.label}</a>
						<span class="muted">{featured.title}</span>
						{#if featured.status && featured.key !== view.onField?.key}
							<span class="state">{STATUS[featured.status]}</span>
						{/if}
					</p>
					{#if featured.red.length > 0 && featured.blue.length > 0}
						<PredictionCard
							red={side(featured, 'red')}
							blue={side(featured, 'blue')}
							me={[...featured.red, ...featured.blue].find((team) => followed.has(team))}
							caption="{featured.label} prediction"
						/>
					{:else}
						<dl class="sides">
							<dt class="red">Red</dt>
							<dd>{@render alliance(featured.red, 'red', featured.pending.red)}</dd>
							<dt class="blue">Blue</dt>
							<dd>{@render alliance(featured.blue, 'blue', featured.pending.blue)}</dd>
						</dl>
					{/if}
				</section>
			{:else if view.selection}
				<section class="block">
					<h2 class="sec-title">Up next</h2>
					<p class="muted">
						Qualification matches are done. Playoffs start after alliance selection.
					</p>
				</section>
			{:else}
				<section class="block">
					<h2 class="sec-title">Up next</h2>
					<p class="muted">No matches are scheduled right now.</p>
				</section>
			{/if}

			{#if stakes}
				<section class="block">
					<h2 class="sec-title">What's at stake in {featured?.label}</h2>
					<MatchStakes {stakes} teams={session.bundle.teams} {followed} />
				</section>
			{/if}

			{#if later.length > 0}
				<section class="block">
					<h2 class="sec-title">Coming up</h2>
					<Table>
						<caption class="visually-hidden">Next matches</caption>
						<thead>
							<tr>
								<th class="l" scope="col">Match</th>
								<th class="l" scope="col">Red</th>
								<th class="l" scope="col">Blue</th>
								<th class="opt" scope="col">Predicted</th>
								<th scope="col">Win chance</th>
							</tr>
						</thead>
						<tbody>
							{#each later as match (match.key)}
								{@const pick = favorite(match)}
								<tr>
									<td class="l">
										<a class="label" href={matchHref(code, match)}>{match.label}</a>
										<span class="sub">
											{#if match.status}{STATUS[match.status]}{:else}{when(match) ?? ''}{/if}
										</span>
									</td>
									<td class="l">{@render alliance(match.red, 'red', match.pending.red)}</td>
									<td class="l">{@render alliance(match.blue, 'blue', match.pending.blue)}</td>
									<td class="muted opt">
										{#if match.forecast}
											{fixed(match.forecast.red.score, 0)}–{fixed(match.forecast.blue.score, 0)}
										{/if}
									</td>
									<td>
										{#if pick}
											<span class={pick.alliance}>{pick.label}</span> {pct(pick.win)}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</Table>
				</section>
			{/if}
		</div>

		<div class="column">
			{#if view.selection}
				<section class="block">
					<h2 class="sec-title">Alliance selection</h2>
					{#if view.selection.state === 'next'}
						<p class="muted">
							Starts soon. The top {view.selection.spots} teams are in line to be captains.
						</p>
					{:else}
						<p class="muted">
							{#if view.selection.state === 'picking' && view.selection.picking !== null}
								Alliance {view.selection.picking} is picking.
							{:else}
								All {view.selection.spots} alliances are set.
							{/if}
						</p>
						<Table>
							<caption class="visually-hidden">Alliances so far</caption>
							<thead>
								<tr>
									<th class="l" scope="col">Alliance</th>
									<th class="l" scope="col">Captain</th>
									<th class="l" scope="col">Picks</th>
								</tr>
							</thead>
							<tbody>
								{#each view.selection.alliances as entry (entry.seed)}
									<tr class:picking={entry.seed === view.selection.picking}>
										<td class="l">{entry.seed}</td>
										<td class="l">
											<TeamChip
												number={entry.captain}
												me={followed.has(entry.captain)}
												href={teamHref(entry.captain, code)}
											/>
										</td>
										<td class="l">
											<span class="chips">
												{#each entry.picks as team (team)}
													<TeamChip
														number={team}
														me={followed.has(team)}
														href={teamHref(team, code)}
													/>
												{/each}
												{#if entry.seed === view.selection.picking}
													<span class="pending">Picking</span>
												{/if}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</Table>
					{/if}
					<p class="note">
						<a href="/events/{code}/alliance-selection">Pick suggestions and playoff odds</a>
					</p>
				</section>
			{/if}

			{#if view.playoffs.length > 0}
				<section class="block">
					<h2 class="sec-title">Playoffs</h2>
					<Table>
						<caption class="visually-hidden">Playoff alliances</caption>
						<thead>
							<tr>
								<th class="l" scope="col">Alliance</th>
								<th class="l" scope="col">Teams</th>
								<th scope="col">W–L</th>
								<th scope="col">Win event</th>
							</tr>
						</thead>
						<tbody>
							{#each view.playoffs as entry (entry.seed)}
								<tr class:dim={entry.out}>
									<td class="l">{entry.seed}</td>
									<td class="l">
										<span class="chips">
											{#each entry.teams as team (team)}
												<TeamChip
													number={team}
													me={followed.has(team)}
													href={teamHref(team, code)}
												/>
											{/each}
										</span>
									</td>
									<td>{entry.wins}–{entry.losses}</td>
									<td>
										{#if entry.won}Won{:else if entry.out}Out{:else}{pct(entry.winEvent)}{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</Table>
				</section>
			{/if}

			<section class="block">
				<h2 class="sec-title">Latest results</h2>
				{#if view.results.length === 0}
					<p class="muted">No results yet.</p>
				{:else}
					<Table>
						<caption class="visually-hidden">Latest results</caption>
						<thead>
							<tr>
								<th class="l" scope="col">Match</th>
								<th class="l" scope="col">Red</th>
								<th scope="col">Score</th>
								<th class="l" scope="col">Blue</th>
							</tr>
						</thead>
						<tbody>
							{#each view.results as result (result.key)}
								<tr>
									<td class="l">
										<a class="label" href={matchHref(code, result)}>{result.label}</a>
										{#each result.tags as tag (tag)}
											<span
												class="tag"
												title={tag === 'upset'
													? upsetNote(result.chance, result.winner)
													: undefined}>{TAG[tag]}</span
											>
										{/each}
									</td>
									<td class="l">{@render alliance(result.red, 'red', null)}</td>
									<td class="score">
										<span class:won={result.winner === 'red'}>{result.redScore}</span><span
											class="dash">–</span
										><span class:won={result.winner === 'blue'}>{result.blueScore}</span>
									</td>
									<td class="l">{@render alliance(result.blue, 'blue', null)}</td>
								</tr>
							{/each}
						</tbody>
					</Table>
					{#if view.results.some((result) => result.tags.includes('upset'))}
						<p class="note">Upset means the winner had less than a 40% chance before the match.</p>
					{/if}
				{/if}
			</section>

			{#if view.standings.length > 0}
				<section class="block">
					<h2 class="sec-title">
						{view.phase === 'quals' ? 'Top 8 now' : 'Top 8 after quals'}
					</h2>
					<Table>
						<caption class="visually-hidden">Top 8 after {view.rankedAfter}</caption>
						<thead>
							<tr>
								<th scope="col">Rank</th>
								<th class="l" scope="col">Team</th>
								<th scope="col"><Term label="RS" /></th>
								<th class="opt" scope="col">Record</th>
								{#if view.since}
									<th scope="col">Since {view.since}</th>
								{/if}
							</tr>
						</thead>
						<tbody>
							{#each view.standings as row (row.team)}
								<tr class:me={followed.has(row.team)}>
									<td>{row.rank}</td>
									<td class="team">
										<TeamCell number={row.team} name={row.name} href={teamHref(row.team, code)} />
									</td>
									<td>{fixed(row.rs, 2)}</td>
									<td class="opt">{row.wins}-{row.losses}-{row.ties}</td>
									{#if view.since}
										<td class="move" aria-label={moveLabel(row.move)}>{move(row.move)}</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</Table>
					{#if view.rankedAfter}
						<p class="note">
							Rankings after {view.rankedAfter}.
							{#if view.phase === 'quals' && !view.since}
								Moves show up after the next ranking update.
							{/if}
						</p>
					{/if}
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	.now {
		display: grid;
		gap: 18px;
	}

	.status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
		font-size: 14px;
		color: var(--text-2);
	}

	.cue {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--line-2);
	}

	.cue.fresh {
		animation: cue 2.4s ease-out;
	}

	@keyframes cue {
		from {
			background: var(--text);
		}
		to {
			background: var(--line-2);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cue.fresh {
			animation: none;
		}
	}

	.delay {
		color: var(--text);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 32px;
		align-items: start;
	}

	.column {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 28px;
		min-width: 0;
	}

	.block {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
		min-width: 0;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}

	.time {
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.match {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
	}

	.match .label {
		font-size: 22px;
		font-weight: 600;
		text-decoration: none;
	}

	.match .label:hover {
		text-decoration: underline;
	}

	.state,
	.tag {
		padding: 1px 7px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-chip);
		font-size: 12.5px;
		font-weight: 500;
		color: var(--text);
		white-space: nowrap;
	}

	.tag {
		margin-left: 6px;
		color: var(--text-2);
	}

	.lead {
		font-size: 17px;
	}

	.sides {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 14px;
		align-items: center;
	}

	.sides dt {
		font-size: 13px;
		font-weight: 500;
	}

	.label {
		font-weight: 600;
	}

	.sub {
		display: block;
		font-size: 12.5px;
		color: var(--text-2);
	}

	.chips {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}

	.pending {
		font-size: 13px;
		color: var(--text-2);
		white-space: nowrap;
	}

	.red {
		color: var(--red);
	}

	.blue {
		color: var(--blue);
	}

	.score span {
		color: var(--text-2);
	}

	.score .dash {
		padding-inline: 1px;
		color: var(--text-3);
	}

	.score .won {
		color: var(--text);
		font-weight: 600;
	}

	.move {
		color: var(--text-2);
	}

	tr.picking td {
		background: var(--surface);
	}

	@media (max-width: 960px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
			gap: 28px;
		}
	}

	@media (max-width: 600px) {
		.chips {
			flex-direction: column;
			align-items: flex-start;
		}

		.tag {
			display: table;
			margin: 4px 0 0;
		}
	}
</style>
