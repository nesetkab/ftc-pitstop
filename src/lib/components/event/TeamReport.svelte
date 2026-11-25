<script lang="ts">
	import Brand from '#lib/ui/Brand.svelte';
	import type { ReportPart, TeamReport } from '#lib/components/event/report.ts';
	import { matchHref } from '#lib/components/event/matches.ts';
	import { fixed, integer, MISSING, ordinal, pct, record, time } from '#lib/format/index.ts';
	import Button from '#lib/ui/Button.svelte';
	import Lede from '#lib/ui/Lede.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import Term from '#lib/ui/Term.svelte';
	import ScoreStrip from './ScoreStrip.svelte';

	interface Props {
		report: TeamReport;
		code: string;
		timeZone: string;
		followed?: ReadonlySet<number>;
		compact?: boolean;
	}

	let { report, code, timeZone, followed = new Set(), compact = false }: Props = $props();

	const NESTED = new Set<ReportPart>(['hive', 'flower', 'garden', 'park']);
	const TERMS: Record<ReportPart, string> = {
		opr: 'aOPR',
		auto: 'Auto aOPR',
		teleop: 'Teleop aOPR',
		hive: 'Hive aOPR',
		flower: 'Flower aOPR',
		garden: 'Garden aOPR',
		park: 'Park aOPR',
		tips: 'Tips aOPR'
	};

	const base = $derived(`/events/${code}`);
	const opr = $derived(report.parts?.find((row) => row.key === 'opr') ?? null);
	const expected = $derived(report.rated === 'expected');
	const valueLabel = $derived(expected ? 'Expected' : 'Here');
	const hasSeason = $derived(report.parts?.some((row) => row.season !== null) ?? false);
	const moreTakeaways = $derived(
		report.takeaways
			.slice(1)
			.map((line) => `${line}.`)
			.join(' ')
	);
	const upcoming = $derived(compact ? report.upcoming.slice(0, 4) : report.upcoming);

	const facts = $derived.by(() => {
		const list: string[] = [];
		const { ranking } = report;
		if (ranking) {
			const scope = report.league ? ' in the league' : '';
			list.push(`Ranked ${ordinal(ranking.rank)} of ${report.rankedOf}${scope}`);
			if (ranking.played > 0) {
				list.push(record(ranking.wins, ranking.losses, ranking.ties));
				list.push(`RS ${fixed(ranking.rs, 2)}`);
			}
		}
		if (opr) {
			const word = expected ? 'Expected aOPR' : 'aOPR';
			list.push(`${word} ${fixed(opr.value)}, ${ordinal(opr.rank)} of ${opr.of} here`);
		}
		if (report.season) {
			list.push(
				`Season aOPR ${fixed(report.season.opr)}, ${ordinal(report.season.rank)} of ${integer(report.season.of)}`
			);
		}
		return list;
	});

	function digits(key: ReportPart): number {
		return key === 'tips' ? 2 : 1;
	}

	function share(earned: number, of: number): string {
		return of > 0 ? rate(earned / of) : MISSING;
	}

	function rate(value: number): string {
		return `${Math.round(value * 100)}%`;
	}
</script>

{#snippet chips(teams: number[], alliance: 'red' | 'blue')}
	<span class="chips">
		{#each teams as team (team)}
			<TeamChip number={team} {alliance} me={followed.has(team)} href="{base}/teams/{team}" />
		{/each}
	</span>
{/snippet}

<article class={['report', { compact }]} aria-labelledby="report-{report.team}">
	<header class="head">
		<div class="title">
			<h2 id="report-{report.team}">
				<span class="num">{report.team}</span>
				{#if report.name}<span class="name"><Brand text={report.name} /></span>{/if}
			</h2>
			{#if facts.length > 0}
				<p class="facts">
					{#each facts as fact (fact)}<span
							><span class="dot" aria-hidden="true">·</span>{fact}</span
						>{/each}
				</p>
			{/if}
		</div>
		{#if !compact}
			<div class="actions">
				<Button variant="secondary" href="/teams/{report.team}">Season page</Button>
				<Button variant="secondary" icon="print" onclick={() => window.print()}>Print</Button>
			</div>
		{/if}
	</header>

	{#if report.takeaways.length > 0 && !compact}
		<Lede lead="{report.takeaways[0]}." rest={moreTakeaways} aria-label="Takeaways" />
	{:else if report.takeaways.length > 0}
		<ul class="takeaways" aria-label="Takeaways">
			{#each report.takeaways as line (line)}
				<li>{line}</li>
			{/each}
		</ul>
	{/if}

	{#if report.league}
		<p class="note">Rankings, record and aOPR include earlier meets in the league.</p>
	{/if}

	<div class="grid">
		{#if report.parts}
			<section class="parts" aria-labelledby="parts-{report.team}">
				<h3 class="sec-title" id="parts-{report.team}">Scoring by part</h3>
				{#if compact}
					<Table>
						<thead>
							<tr>
								<th class="l" scope="col"><span class="visually-hidden">Measure</span></th>
								{#each report.parts as row (row.key)}
									<th scope="col"><Term label={row.label} term={TERMS[row.key]} /></th>
								{/each}
							</tr>
						</thead>
						<tbody>
							<tr>
								<th class="l row" scope="row">{valueLabel}</th>
								{#each report.parts as row (row.key)}
									<td class="strong">{fixed(row.value, digits(row.key))}</td>
								{/each}
							</tr>
							<tr>
								<th class="l row" scope="row">Rank</th>
								{#each report.parts as row (row.key)}
									<td>{ordinal(row.rank)}</td>
								{/each}
							</tr>
							<tr>
								<th class="l row" scope="row">Event avg</th>
								{#each report.parts as row (row.key)}
									<td class="muted">{fixed(row.average, digits(row.key))}</td>
								{/each}
							</tr>
							{#if hasSeason}
								<tr>
									<th class="l row" scope="row">Season</th>
									{#each report.parts as row (row.key)}
										<td class="muted">{fixed(row.season, digits(row.key))}</td>
									{/each}
								</tr>
							{/if}
						</tbody>
					</Table>
				{:else}
					<Table>
						<thead>
							<tr>
								<th class="l" scope="col">Part</th>
								<th scope="col">{valueLabel}</th>
								<th scope="col">Rank</th>
								<th scope="col">Event avg</th>
								{#if hasSeason}<th class="sep" scope="col">Season</th>{/if}
							</tr>
						</thead>
						<tbody>
							{#each report.parts as row (row.key)}
								<tr>
									<th class={['l', 'row', { nested: NESTED.has(row.key) }]} scope="row">
										<Term label={row.label} term={TERMS[row.key]} />
									</th>
									<td class="strong">{fixed(row.value, digits(row.key))}</td>
									<td>{ordinal(row.rank)} <span class="faint">of {row.of}</span></td>
									<td class="muted">{fixed(row.average, digits(row.key))}</td>
									{#if hasSeason}
										<td class="sep muted">{fixed(row.season, digits(row.key))}</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</Table>
				{/if}
				{#if expected}
					<p class={['note', { 'screen-only': compact }]}>
						Expected values come from season form before this event.
					</p>
				{/if}
			</section>
		{/if}

		<section class="consistency" aria-labelledby="spread-{report.team}">
			<h3 class="sec-title" id="spread-{report.team}">Match by match</h3>
			{#if report.spread}
				<dl class="stats">
					<div>
						<dt>Average</dt>
						<dd>{integer(report.spread.average)}</dd>
					</div>
					<div>
						<dt><Term label="Spread" /></dt>
						<dd>±{integer(report.spread.sd)}</dd>
					</div>
					<div>
						<dt>Best</dt>
						<dd>
							{integer(report.spread.best.score)}
							<span class="faint">{report.spread.best.label}</span>
						</dd>
					</div>
					<div>
						<dt>Worst</dt>
						<dd>
							{integer(report.spread.worst.score)}
							<span class="faint">{report.spread.worst.label}</span>
						</dd>
					</div>
				</dl>
				<ScoreStrip
					{code}
					matches={report.played}
					scale={report.scale}
					average={report.eventAverage}
				/>
				<p class={['note', { 'screen-only': compact }]}>
					Faded bars are losses. The dashed line is the event average.
				</p>
			{:else}
				<p class="muted">
					{report.eventStarted ? 'No matches played here.' : 'No matches played yet.'}
				</p>
			{/if}
		</section>

		{#if report.rp || (report.trend && !compact)}
			<section class="habits" aria-labelledby="rp-{report.team}">
				{#if report.rp}
					<h3 class="sec-title" id="rp-{report.team}">Ranking points</h3>
					<table class="t rp">
						<thead>
							<tr>
								<th class="l" scope="col"><span class="visually-hidden">Ranking point</span></th>
								<th scope="col">Earned</th>
								<th scope="col">Rate</th>
								<th scope="col">Event</th>
							</tr>
						</thead>
						<tbody>
							{#each report.rp.habits as habit (habit.key)}
								<tr>
									<th class="l row" scope="row"
										><Term
											label={habit.label}
											term={habit.key === 'swarm'
												? 'Swarm'
												: habit.key === 'pollinator1'
													? 'Poll. 1'
													: 'Poll. 2'}
										/></th
									>
									<td>{habit.earned} <span class="faint">of {report.rp.played}</span></td>
									<td class="strong">{share(habit.earned, report.rp.played)}</td>
									<td class="muted">{rate(habit.event)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
				{#if report.trend && !compact}
					<h3 class="sec-title trend-title">Trend</h3>
					<dl class="stats">
						<div>
							<dt>First {report.trend.firstCount}</dt>
							<dd>{integer(report.trend.first)}</dd>
						</div>
						<div>
							<dt>Last {report.trend.secondCount}</dt>
							<dd>{integer(report.trend.second)}</dd>
						</div>
						{#if report.trend.recent}
							<div>
								<dt>Last 3</dt>
								<dd>{integer(report.trend.recent.average)}</dd>
							</div>
						{/if}
					</dl>
					<p class="note">Each number is an average alliance score.</p>
				{/if}
			</section>
		{/if}

		{#if compact}
			<div class="notes" aria-hidden="true">
				<span>Notes</span>
				{#each [1, 2, 3, 4, 5] as line (line)}<i></i>{/each}
			</div>
		{/if}
	</div>

	{#if report.upcoming.length > 0}
		<section class="upcoming" aria-labelledby="next-{report.team}">
			<h3 class="sec-title" id="next-{report.team}">Remaining matches</h3>
			<Table>
				<thead>
					<tr>
						<th class="l" scope="col">Match</th>
						<th class="l" scope="col">Time</th>
						<th class="l" scope="col">With</th>
						<th class="l" scope="col">Against</th>
						<th scope="col">Predicted</th>
						<th scope="col">Win chance</th>
					</tr>
				</thead>
				<tbody>
					{#each upcoming as match (match.key)}
						<tr>
							<td class="l"><a href={matchHref(code, match)}>{match.label}</a></td>
							<td class="l muted">{match.time === null ? MISSING : time(match.time, timeZone)}</td>
							<td class="l">{@render chips(match.partners, match.alliance)}</td>
							<td class="l"
								>{@render chips(match.opponents, match.alliance === 'red' ? 'blue' : 'red')}</td
							>
							<td class="muted"
								>{match.score === null
									? MISSING
									: `${integer(match.score)}–${integer(match.opponentScore)}`}</td
							>
							<td class="strong">{pct(match.win)}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		</section>
	{/if}
</article>

<style>
	.report {
		display: grid;
		gap: 20px;
		min-width: 0;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px 20px;
	}

	.title {
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	h2 {
		font-size: 22px;
		line-height: 1.25;
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.name {
		margin-left: 6px;
		font-weight: 500;
		color: var(--text-2);
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 0;
		margin-left: -20px;
		clip-path: inset(0 0 0 20px);
		font-size: 14px;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	.dot {
		display: inline-block;
		width: 20px;
		color: var(--text-3);
		text-align: center;
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.takeaways {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0 0 0 14px;
		border-left: 2px solid var(--text);
		list-style: none;
		font-size: 16px;
		line-height: 1.4;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
		gap: 28px 40px;
		align-items: start;
	}

	section {
		display: grid;
		gap: 10px;
		align-content: start;
		min-width: 0;
	}

	th.row {
		white-space: nowrap;
		padding: 9px 10px;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		font-weight: 400;
		color: var(--text);
	}

	th.nested {
		padding-left: 24px;
		color: var(--text-2);
	}

	td.strong {
		font-weight: 600;
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 28px;
	}

	.stats div {
		display: grid;
		gap: 2px;
	}

	.stats dt {
		font-size: 12.5px;
		color: var(--text-3);
	}

	.stats dd {
		font-size: 20px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.stats dd .faint {
		font-size: 13px;
		font-weight: 400;
	}

	.trend-title {
		margin-top: 12px;
	}

	.chips {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.upcoming a {
		font-weight: 600;
	}

	.notes {
		display: none;
	}

	.compact {
		gap: 12px;
		font-size: 13px;
	}

	.compact h2 {
		font-size: 18px;
	}

	.compact .facts {
		font-size: 13px;
	}

	.compact .takeaways {
		font-size: 14px;
		gap: 2px;
	}

	.compact .grid {
		grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
		gap: 14px 28px;
	}

	.compact .parts {
		grid-column: 1 / -1;
	}

	.compact section {
		gap: 6px;
	}

	.compact .stats {
		gap: 6px 20px;
	}

	.compact .stats dd {
		font-size: 16px;
	}

	.compact .note {
		font-size: 12px;
	}

	.compact :global(table.t td),
	.compact th.row {
		padding: 5px 8px;
		font-size: 13px;
	}

	@media (max-width: 600px) {
		.actions {
			width: 100%;
		}

		th.row {
			padding-inline: 6px;
		}

		th.nested {
			padding-left: 16px;
		}
	}

	@media print {
		.actions {
			display: none;
		}

		.report {
			gap: 10px;
			font-size: 11px;
		}

		.head h2 {
			font-size: 17px;
		}

		.facts {
			font-size: 11px;
		}

		.takeaways {
			gap: 1px;
			font-size: 12px;
		}

		.compact .takeaways {
			font-size: 11px;
		}

		.compact :global(svg.strip) {
			width: auto;
			height: 76px;
		}

		.grid {
			grid-template-columns: 1fr 1fr;
			gap: 10px 24px;
		}

		.parts {
			grid-row: span 2;
		}

		.compact .grid {
			grid-template-columns: 1.1fr 1fr 0.9fr;
			gap: 8px 20px;
		}

		.screen-only {
			display: none;
		}

		.report.compact :global(table.t td),
		.compact th.row.row {
			padding: 2px 6px;
		}

		.compact .parts {
			grid-column: 1 / -1;
			grid-row: auto;
		}

		section {
			gap: 4px;
			break-inside: avoid;
		}

		.sec-title {
			font-size: 12px;
		}

		.stats dd,
		.compact .stats dd {
			font-size: 14px;
		}

		.stats dt,
		.note {
			font-size: 9.5px;
		}

		.report :global(table.t th) {
			padding: 0 6px 3px;
			font-size: 9.5px;
		}

		.report :global(table.t td),
		th.row {
			padding: 3px 6px;
			font-size: 11px;
		}

		th.nested {
			padding-left: 14px;
		}

		.notes {
			display: block;
			font-size: 10px;
			color: var(--text-3);
		}

		.notes i {
			display: block;
			height: 6mm;
			border-bottom: 1px solid var(--line-2);
		}
	}
</style>
