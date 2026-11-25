<script lang="ts">
	import {
		dateRange,
		fixed,
		integer,
		longDate,
		matchLabel,
		matchTitle,
		ordinal,
		parseMatchDescription,
		pct,
		record,
		relative,
		shortDate,
		shortMatchLabel,
		signed,
		time,
		timeWithSeconds
	} from '#lib/format/index.ts';
	import AllianceChip from '#lib/ui/AllianceChip.svelte';
	import Bars from '#lib/ui/Bars.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FinishSpark from '#lib/ui/FinishSpark.svelte';
	import KeyValue from '#lib/ui/KeyValue.svelte';
	import LineChart from '#lib/ui/LineChart.svelte';
	import Logo from '#lib/ui/Logo.svelte';
	import MatchList from '#lib/ui/MatchList.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import PredictionCard from '#lib/ui/PredictionCard.svelte';
	import ProbCell from '#lib/ui/ProbCell.svelte';
	import SearchDialog from '#lib/ui/SearchDialog.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import Table from '#lib/ui/Table.svelte';
	import Tabs from '#lib/ui/Tabs.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import Toggle from '#lib/ui/Toggle.svelte';
	import type { SearchResult } from '#lib/ui/search.svelte.ts';
	import {
		EVENT,
		ME,
		alerts,
		available,
		epaLine,
		eventTabs,
		expectedRp,
		ourMatches,
		percentiles,
		phoneFacts,
		picked,
		pointBars,
		prediction,
		rankingPoints,
		rankings,
		sampleSearch,
		strength
	} from './sample.ts';

	const loadedAt = Date.now();
	const fresh = new Date(loadedAt - 12_000);
	const old = new Date(loadedAt - 14 * 60_000);
	const queueAt = new Date('2026-11-14T20:46:00Z');
	const postedAt = new Date('2026-11-14T20:41:02Z');

	const swatches = [
		'bg',
		'surface',
		'line',
		'line-2',
		'text',
		'text-2',
		'text-3',
		'accent',
		'accent-wash',
		'red',
		'red-wash',
		'blue',
		'blue-wash'
	];

	const examples: [string, string][] = [
		['pct(0.586)', pct(0.586)],
		['pct(0.004)', pct(0.004)],
		['pct(0.9971)', pct(0.9971)],
		['pct(null)', pct(null)],
		['fixed(25.08)', fixed(25.08)],
		['fixed(3.333, 2)', fixed(3.333, 2)],
		['signed(15.2)', signed(15.2)],
		['signed(-11.2)', signed(-11.2)],
		['integer(3272)', integer(3272)],
		['record(3, 0, 0)', record(3, 0, 0)],
		['ordinal(93)', ordinal(93)],
		['time(queue, Phoenix)', time(queueAt, EVENT.timeZone)],
		['timeWithSeconds(posted, Phoenix)', timeWithSeconds(postedAt, EVENT.timeZone)],
		['longDate("2026-11-14")', longDate(EVENT.start)],
		['shortDate("2026-11-14")', shortDate(EVENT.start)],
		['dateRange("2026-11-20", "2026-11-21")', dateRange('2026-11-20', '2026-11-21')],
		['relative(12 seconds earlier)', relative(fresh, loadedAt)],
		['relative(5 minutes later)', relative(loadedAt + 300_000, loadedAt)],
		['matchLabel(qualification 26)', matchLabel({ level: 'qual', number: 26 })],
		[
			'shortMatchLabel("Upper Bracket Round 1 Match 1")',
			shortMatchLabel('Upper Bracket  Round 1 Match 1')
		],
		[
			'matchTitle("Lower Bracket Round 2 Match 5")',
			matchTitle(parseMatchDescription('Lower Bracket  Round 2 Match 5')!)
		]
	];

	let kitSearchOpen = $state(false);
	let chosen = $state<SearchResult | null>(null);
	let alertState = $state(alerts.map((alert) => ({ ...alert })));

	function top4(dist: number[]) {
		return dist.slice(0, 4).reduce((sum, value) => sum + value, 0);
	}
</script>

<svelte:head>
	<title>PitStop UI kit</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="kit">
	<PageHeader
		title="UI kit"
		meta="Shared components with sample data from the {EVENT.name}, November 14, 2026, as seen by team 14624."
	>
		{#snippet status()}
			<b>22 of 34</b> qualification matches played. <StaleNotice
				updated={fresh}
				timeZone={EVENT.timeZone}
			/>.
		{/snippet}
	</PageHeader>

	<section class="kit-section" aria-labelledby="kit-tokens">
		<h2 id="kit-tokens">Tokens and type</h2>
		<div class="swatches">
			{#each swatches as name (name)}
				<div class="swatch">
					<span class="color" style:background="var(--{name})"></span>
					<code>--{name}</code>
				</div>
			{/each}
		</div>
		<div class="type">
			<h3>Pit display</h3>
			<p>Runs full screen on the TV in your pit and keeps the screen awake. Updates on its own.</p>
			<p class="muted">Qualifier at Gilbert Christian High School, Gilbert, Arizona.</p>
			<p class="sec-title">Ranking point chances</p>
			<p class="note">
				RS is the average ranking points per match. TBP is the average match score without
				penalties.
			</p>
			<p class="n">0123456789 25.1 3.33 58–57</p>
		</div>
		<div class="logos">
			<Logo />
			<Logo height="15px" />
		</div>
	</section>

	<section class="kit-section" aria-labelledby="kit-controls">
		<h2 id="kit-controls">Buttons, toggles and chips</h2>
		<div class="row">
			<Button>Copy link</Button>
			<Button variant="secondary">Open pit display</Button>
			<Button variant="secondary">Follow</Button>
			<Button href="/dev/kit">Link button</Button>
			<Button disabled>Disabled</Button>
		</div>
		<div class="row">
			<AllianceChip alliance="red" />
			<AllianceChip alliance="blue" />
			<AllianceChip alliance="red" label="Red alliance" />
			<TeamChip number={14624} alliance="red" me />
			<TeamChip number={25620} alliance="red" />
			<TeamChip number={32043} alliance="blue" />
			<TeamChip number={22258} alliance="blue" />
			<TeamChip number={2844} />
		</div>
		<div class="row">
			<TeamCell number={26670} name="SCA Iron Eagles" />
			<TeamCell number={14624} name="Cat-Astrophic Byte" href="/dev/kit" />
			<TeamCell number={3747} />
		</div>
		<div class="toggles">
			<p class="sec-title">Alerts</p>
			{#each alertState as alert (alert.label)}
				<Toggle label={alert.label} bind:checked={alert.on} />
			{/each}
			<Toggle label="Queue alerts from Nexus" disabled />
		</div>
	</section>

	<section class="kit-section" aria-labelledby="kit-header">
		<h2 id="kit-header">Page header and tabs</h2>
		<div class="frame">
			<PageHeader title={EVENT.name} meta={EVENT.meta}>
				{#snippet status()}
					<b>22 of 34</b> qualification matches played. <StaleNotice
						updated={fresh}
						timeZone={EVENT.timeZone}
					/>.
				{/snippet}
				{#snippet actions()}
					<Button variant="secondary">Open pit display</Button>
				{/snippet}
			</PageHeader>
			<Tabs tabs={eventTabs} current="/events/{EVENT.code}/rankings" label="Event" />
		</div>
		<div class="frame">
			<PageHeader title="Montana Qualifier - Butte MT-Tech">
				{#snippet status()}
					<StaleNotice updated={old} timeZone={EVENT.timeZone} />.
				{/snippet}
			</PageHeader>
			<EmptyState title="The match schedule hasn't been posted yet.">
				This page and your pit display fill in on their own once it is.
			</EmptyState>
		</div>
	</section>

	<section class="kit-section" aria-labelledby="kit-rankings">
		<h2 id="kit-rankings">Rankings table</h2>
		<Table>
			<thead>
				<tr>
					<td colspan="8"></td>
					<th colspan="3" scope="colgroup" class="group sep">Projected after 34 matches</th>
				</tr>
				<tr>
					<th class="l" scope="col">Rank</th>
					<th class="l" scope="col">Team</th>
					<th scope="col">RS</th>
					<th scope="col">Record</th>
					<th scope="col">TBP</th>
					<th scope="col">Avg tips</th>
					<th scope="col">aOPR</th>
					<th scope="col">EPA</th>
					<th class="sep" scope="col">Finish, 1st to 27th</th>
					<th scope="col">Top 4</th>
					<th scope="col">Top 8</th>
				</tr>
			</thead>
			<tbody>
				{#each rankings as row (row.team)}
					<tr class:me={row.team === ME}>
						<td class="l">{row.rank}</td>
						<td class="team"><TeamCell number={row.team} name={row.name} /></td>
						<td>{fixed(row.rs, 2)}</td>
						<td>{record(row.wins, row.losses, row.ties)}</td>
						<td>{fixed(row.tbp)}</td>
						<td>{fixed(row.tips)}</td>
						<td>{fixed(row.opr)}</td>
						<td>{fixed(row.epa)}</td>
						<td class="sep"><FinishSpark dist={row.dist} /></td>
						<ProbCell p={top4(row.dist)} />
						<ProbCell p={row.top8} />
					</tr>
				{/each}
			</tbody>
		</Table>
		<p class="note">
			Showing 14 of 27 teams. RS is the average ranking points per match. TBP is the average match
			score without penalties.
		</p>
	</section>

	<section class="kit-section" aria-labelledby="kit-tables">
		<h2 id="kit-tables">More tables</h2>
		<div class="panel schedule">
			<span class="sec-title">Schedule so far</span>
			<Table>
				<thead>
					<tr>
						<th class="l" scope="col">Team</th>
						<th scope="col">Rank</th>
						<th scope="col">Rank by EPA</th>
						<th scope="col">Partners' EPA</th>
						<th scope="col">Opponents' EPA</th>
						<th scope="col">Difference</th>
					</tr>
				</thead>
				<tbody>
					{#each strength as row (row.team)}
						<tr class:me={row.team === ME}>
							<td class="team"><TeamCell number={row.team} name={row.name} /></td>
							<td>{row.rank}</td>
							<td>{row.epaRank}</td>
							<td>{fixed(row.partners)}</td>
							<td>{fixed(row.opponents)}</td>
							<td>{signed(row.partners - row.opponents)}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		</div>
		<div class="grid2">
			<div class="panel">
				<span class="sec-title">Sticky header</span>
				<Table sticky maxHeight="240px">
					<thead>
						<tr>
							<th class="l" scope="col">#</th>
							<th class="l" scope="col">Team</th>
							<th scope="col">RS</th>
							<th scope="col">Record</th>
						</tr>
					</thead>
					<tbody>
						{#each rankings as row (row.team)}
							<tr class:me={row.team === ME}>
								<td class="l">{row.rank}</td>
								<td class="team"><TeamCell number={row.team} name={row.name} /></td>
								<td>{fixed(row.rs, 2)}</td>
								<td>{record(row.wins, row.losses, row.ties)}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			</div>
			<div class="panel">
				<span class="sec-title">Empty state</span>
				<EmptyState title="No alliance selection yet.">
					Alliances show here once qualification matches are done.
				</EmptyState>
			</div>
		</div>
		<div class="panel">
			<span class="sec-title">Available teams</span>
			<Table>
				<thead>
					<tr>
						<th class="l" scope="col">Team</th>
						<th scope="col">aOPR</th>
						<th scope="col">Auto aOPR</th>
						<th scope="col">Avg tips</th>
						<th scope="col">Avg park</th>
						<th scope="col">Win round 1</th>
						<th scope="col">Reach upper final</th>
					</tr>
				</thead>
				<tbody>
					{#each available as row (row.team)}
						<tr>
							<td class="team"><TeamCell number={row.team} name={row.name} /></td>
							<td>{fixed(row.opr)}</td>
							<td>{fixed(row.auto)}</td>
							<td>{fixed(row.tips)}</td>
							<td>{fixed(row.park)}</td>
							<ProbCell p={row.round1} shade={false} />
							<ProbCell p={row.final} shade={false} />
						</tr>
					{/each}
					<tr class="dim">
						<td class="team"><TeamCell number={picked.team} name={picked.name} /></td>
						<td>{fixed(picked.opr)}</td>
						<td>{fixed(picked.auto)}</td>
						<td>{fixed(picked.tips)}</td>
						<td>{fixed(picked.park)}</td>
						<td colspan="2">Picked by alliance {picked.by}</td>
					</tr>
				</tbody>
			</Table>
		</div>
	</section>

	<section class="kit-section" aria-labelledby="kit-prediction">
		<h2 id="kit-prediction">Match preview</h2>
		<PageHeader
			title={matchTitle({ level: 'qual', number: 26 })}
			meta="Scheduled for {time(
				new Date('2026-11-14T20:58:00Z'),
				EVENT.timeZone
			)}. Expected around {time(new Date('2026-11-14T21:01:00Z'), EVENT.timeZone)}. Not played yet."
		/>
		<div class="layout-2">
			<div class="panel wide-gap">
				<PredictionCard
					red={prediction.red}
					blue={prediction.blue}
					me={ME}
					caption="Q26 prediction"
				/>
				<div class="phone-width">
					<PredictionCard
						red={prediction.red}
						blue={prediction.blue}
						me={ME}
						compact
						caption="Q26 prediction, compact"
					/>
				</div>
			</div>
			<div class="panel wide-gap">
				<div class="panel">
					<span class="sec-title">Ranking point chances</span>
					<Table>
						<thead>
							<tr>
								<th class="l" scope="col"><span class="visually-hidden">Outcome</span></th>
								<th scope="col">Red</th>
								<th scope="col">Blue</th>
							</tr>
						</thead>
						<tbody>
							{#each rankingPoints as row (row.label)}
								<tr>
									<td class="l">{row.label}</td>
									<td>{pct(row.red)}</td>
									<td>{pct(row.blue)}</td>
								</tr>
							{/each}
							<tr>
								<td class="l">Expected RP</td>
								<td>{fixed(expectedRp.red, 2)}</td>
								<td>{fixed(expectedRp.blue, 2)}</td>
							</tr>
						</tbody>
					</Table>
				</div>
				<div class="panel">
					<span class="sec-title">Average points per alliance at this event</span>
					<Bars items={pointBars} />
					<p class="note">From 44 alliance scores in 22 matches.</p>
				</div>
			</div>
		</div>
	</section>

	<section class="kit-section" aria-labelledby="kit-team">
		<h2 id="kit-team">Team page charts</h2>
		<div class="grid2">
			<div class="panel">
				<span class="sec-title">EPA after each match</span>
				<LineChart
					points={epaLine}
					label="EPA after each match for 26670"
					yName="EPA"
					divider={{ after: 5, label: 'Playoffs' }}
				/>
			</div>
			<div class="panel">
				<span class="sec-title">Compared with all teams this season</span>
				<Table>
					<thead>
						<tr>
							<th class="l" scope="col"><span class="visually-hidden">Part</span></th>
							<th scope="col">aOPR</th>
							<th scope="col">Percentile</th>
						</tr>
					</thead>
					<tbody>
						{#each percentiles as row (row.label)}
							<tr>
								<td class="l">{row.label}</td>
								<td>{fixed(row.opr)}</td>
								<td>{ordinal(row.percentile)}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
				<span class="sec-title spaced">Finish chances for 14624</span>
				<FinishSpark dist={rankings[6].dist} width={216} height={36} />
			</div>
		</div>
	</section>

	<section class="kit-section" aria-labelledby="kit-phone">
		<h2 id="kit-phone">Phone and pit display parts</h2>
		<div class="parts">
			<div class="panel phone-width">
				<span class="sec-title">This event</span>
				<KeyValue items={phoneFacts} />
				<span class="sec-title spaced">Our matches</span>
				<MatchList items={ourMatches} />
			</div>
			<div class="pit tv-column">
				<span class="tv-label">Our matches</span>
				<MatchList items={ourMatches} />
				<span class="tv-label">Next match</span>
				<div class="tv-teams">
					<TeamChip number={14624} alliance="red" me />
					<TeamChip number={25620} alliance="red" />
					<TeamChip number={32043} alliance="blue" />
					<TeamChip number={22258} alliance="blue" />
				</div>
				<p class="tv-foot">
					<StaleNotice updated={fresh} timeZone={EVENT.timeZone} /> from FTC Events
				</p>
			</div>
		</div>
	</section>

	<section class="kit-section" aria-labelledby="kit-search">
		<h2 id="kit-search">Search</h2>
		<p class="muted">
			Press <kbd>/</kbd> or <kbd>Ctrl</kbd> <kbd>K</kbd> anywhere to open search. This button opens the
			same dialog with sample teams and events.
		</p>
		<div class="row">
			<Button variant="secondary" onclick={() => (kitSearchOpen = true)}>
				Search sample teams and events
			</Button>
			{#if chosen}
				<span class="muted">Picked {chosen.label}, which links to {chosen.href}.</span>
			{/if}
		</div>
		<SearchDialog
			bind:open={kitSearchOpen}
			search={sampleSearch}
			shortcuts={false}
			onselect={(result) => (chosen = result)}
		/>
	</section>

	<section class="kit-section" aria-labelledby="kit-format">
		<h2 id="kit-format">Format helpers</h2>
		<div class="grid2 even">
			{#each [examples.slice(0, 11), examples.slice(11)] as half, index (index)}
				<Table>
					<thead>
						<tr>
							<th class="l" scope="col">Call</th>
							<th class="l" scope="col">Output</th>
						</tr>
					</thead>
					<tbody>
						{#each half as [call, output] (call)}
							<tr>
								<td class="l"><code>{call}</code></td>
								<td class="l">{output}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{/each}
		</div>
	</section>

	<section class="kit-section" aria-labelledby="kit-themes">
		<h2 id="kit-themes">Both themes</h2>
		<p class="muted">
			These panels set <code>data-theme</code> on a wrapper, so they ignore the page theme.
		</p>
		<div class="themes">
			{#each ['light', 'dark'] as mode (mode)}
				<div class="theme-panel" data-theme={mode}>
					<span class="sec-title">{mode === 'light' ? 'Light' : 'Dark'}</span>
					<PredictionCard
						red={prediction.red}
						blue={prediction.blue}
						me={ME}
						compact
						caption="Q26 prediction in {mode} theme"
					/>
					<Table>
						<thead>
							<tr>
								<th class="l" scope="col">Rank</th>
								<th class="l" scope="col">Team</th>
								<th scope="col">EPA</th>
								<th scope="col">Top 8</th>
							</tr>
						</thead>
						<tbody>
							{#each rankings.slice(4, 9) as row (row.team)}
								<tr class:me={row.team === ME}>
									<td class="l">{row.rank}</td>
									<td class="team"><TeamCell number={row.team} name={row.name} /></td>
									<td>{fixed(row.epa)}</td>
									<ProbCell p={row.top8} />
								</tr>
							{/each}
						</tbody>
					</Table>
					<Bars items={pointBars} />
					<div class="row">
						<AllianceChip alliance="red" />
						<AllianceChip alliance="blue" />
						<Button>Copy link</Button>
						<Button variant="secondary">Follow</Button>
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>

<style>
	.kit {
		display: grid;
		gap: 56px;
	}

	.kit-section {
		display: grid;
		gap: 18px;
		min-width: 0;
	}

	.kit-section > h2 {
		font-size: 20px;
		line-height: 1.25;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--line);
	}

	.swatches {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 12px;
	}

	.swatch {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
	}

	.color {
		flex: none;
		width: 32px;
		height: 32px;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
	}

	code {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 12.5px;
		color: var(--text-2);
	}

	.type {
		display: grid;
		gap: 8px;
		max-width: 760px;
	}

	.logos {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 28px;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 14px;
	}

	.toggles {
		display: grid;
		gap: 8px;
		max-width: 360px;
	}

	.frame {
		display: grid;
		gap: 22px;
		padding: 24px;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
	}

	.panel {
		display: grid;
		gap: 10px;
		align-content: start;
		min-width: 0;
	}

	.wide-gap {
		gap: 18px;
	}

	.spaced {
		margin-top: 12px;
	}

	.grid2 {
		display: grid;
		grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
		gap: 28px;
		align-items: start;
	}

	.layout-2 {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 300px;
		gap: 28px;
		align-items: start;
	}

	.phone-width {
		max-width: 390px;
	}

	.parts {
		display: flex;
		flex-wrap: wrap;
		gap: 28px;
		align-items: start;
	}

	.parts .phone-width {
		flex: 1 1 320px;
	}

	.tv-column {
		display: grid;
		gap: 0.9em;
		flex: 1 1 340px;
		max-width: 420px;
		padding: 1.3em 1.4em;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		font-size: 17px;
		line-height: 1.25;
	}

	.tv-label {
		font-size: 0.8em;
		font-weight: 500;
		color: var(--text-2);
	}

	.tv-teams {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5em;
	}

	.tv-foot {
		font-size: 0.72em;
		color: var(--text-2);
	}

	.schedule {
		max-width: 780px;
	}

	.grid2.even {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.themes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px;
	}

	.theme-panel {
		display: grid;
		gap: 18px;
		align-content: start;
		min-width: 0;
		padding: 20px;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
	}

	@media (max-width: 1060px) {
		.grid2,
		.grid2.even,
		.layout-2,
		.themes {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
