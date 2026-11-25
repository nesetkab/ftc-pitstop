<script lang="ts">
	import { page } from '$app/state';
	import FollowButton from '#lib/components/team/FollowButton.svelte';
	import LastSeason from '#lib/components/team/LastSeason.svelte';
	import OprCharts from '#lib/components/team/OprCharts.svelte';
	import PitScreens from '#lib/components/team/PitScreens.svelte';
	import SeasonTakeaways from '#lib/components/team/SeasonTakeaways.svelte';
	import TeamAllies from '#lib/components/team/TeamAllies.svelte';
	import TeamAwards from '#lib/components/team/TeamAwards.svelte';
	import TeamBadges from '#lib/components/team/TeamBadges.svelte';
	import TeamBreakdown from '#lib/components/team/TeamBreakdown.svelte';
	import TeamEvents from '#lib/components/team/TeamEvents.svelte';
	import TeamMatches from '#lib/components/team/TeamMatches.svelte';
	import TeamStats from '#lib/components/team/TeamStats.svelte';
	import UpcomingEvents from '#lib/components/team/UpcomingEvents.svelte';
	import { breadcrumbs, teamDescription, teamJsonLd, teamTitle } from '#lib/seo.ts';
	import Button from '#lib/ui/Button.svelte';
	import CalendarMenu from '#lib/ui/CalendarMenu.svelte';
	import Hint from '#lib/ui/Hint.svelte';
	import { eventThisWeek, PIT_HINT } from '#lib/ui/hints.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = $derived(data.view);
	const meta = $derived(
		[view.team.place, view.team.rookieYear ? `Rookie year ${view.team.rookieYear}` : '']
			.filter(Boolean)
			.join('. ')
	);
	const pitEvent = $derived(eventThisWeek(view.upcoming, Date.now()));
	const hasStats = $derived(view.stats.events > 0 || view.stats.opr !== null);
	const previousTitle = $derived(
		view.previous ? `Last season, ${view.previous.game ?? view.previous.season}` : ''
	);
</script>

<Seo
	title={teamTitle(view.team)}
	description={teamDescription(view.team, view.stats)}
	path="/teams/{view.team.number}"
	data={[
		teamJsonLd(page.url.origin, view.team),
		breadcrumbs(page.url.origin, [
			{ name: 'PitStop', path: '/' },
			{ name: 'Leaderboards', path: '/leaderboards' },
			{ name: `${view.team.number} ${view.team.name}`, path: `/teams/${view.team.number}` }
		])
	]}
/>

<div class="summary">
	<PageHeader title="{view.team.number} {view.team.name}" meta={meta ? `${meta}.` : undefined}>
		{#snippet status()}
			{#if view.stale}
				Showing saved data. <StaleNotice updated={view.updated} />.
			{/if}
		{/snippet}
		{#snippet actions()}
			<div class="team-actions">
				<FollowButton number={view.team.number} />
				<Button variant="secondary" icon="compare" href="/compare?teams={view.team.number}"
					>Compare</Button
				>
				<PitScreens number={view.team.number} />
				<CalendarMenu
					label="Calendar"
					path="/teams/{view.team.number}/calendar.ics"
					filename="{view.team.number}.ics"
					note="This team's events and matches with estimated start times. Subscribed calendars update as schedules come out."
				/>
			</div>
		{/snippet}
	</PageHeader>

	<SeasonTakeaways lines={view.takeaways} />

	{#if hasStats}
		<TeamStats
			stats={view.stats}
			trend={view.trend}
			team={view.source === 'ratings' ? view.team.number : undefined}
		/>
	{/if}
</div>

{#if pitEvent}
	<Hint id={PIT_HINT}>
		At {pitEvent.name}{pitEvent.live ? ' today' : ' this week'}? Put the
		<a href="/{view.team.number}/tv">pit display</a> on your pit TV and the
		<a href="/{view.team.number}">phone view</a> on your phone.
	</Hint>
{/if}

{#if view.upcoming.length > 0}
	<section class="panel" aria-labelledby="upcoming-title">
		<h2 class="sec-title" id="upcoming-title">Coming up</h2>
		<UpcomingEvents rows={view.upcoming} team={view.team.number} />
	</section>
{/if}

{#if view.charts.length > 0}
	<section class="panel" aria-labelledby="opr-title">
		<h2 class="sec-title" id="opr-title">{view.chartTitle}</h2>
		<OprCharts charts={view.charts} />
	</section>
{/if}

{#if view.events.length > 0 || view.upcoming.length === 0}
	<section class="panel" aria-labelledby="events-title">
		<div class="head">
			<h2 class="sec-title" id="events-title">Events</h2>
			{#if view.stats.events > 0}
				<a href="/records?team={view.team.number}">Highest scores with {view.team.number}</a>
			{/if}
		</div>
		<TeamEvents rows={view.events} team={view.team.number} />
	</section>
{/if}

{#if view.awards.length > 0}
	<section class="panel awards" aria-labelledby="awards-title">
		<h2 class="sec-title" id="awards-title">Awards</h2>
		<TeamAwards rows={view.awards} />
	</section>
{/if}

{#if view.breakdown.length > 0}
	<section class="panel" aria-labelledby="breakdown-title">
		<h2 class="sec-title" id="breakdown-title">Scoring by event</h2>
		<TeamBreakdown rows={view.breakdown} comparison={view.comparison} />
	</section>
{/if}

{#if view.allies.partnerCount > 0}
	<div class="pair">
		<section class="panel" aria-labelledby="partners-title">
			<h2 class="sec-title" id="partners-title">Partners</h2>
			<TeamAllies kind="partners" rows={view.allies.partners} total={view.allies.partnerCount} />
		</section>
		<section class="panel" aria-labelledby="opponents-title">
			<h2 class="sec-title" id="opponents-title">Toughest opponents</h2>
			<TeamAllies kind="opponents" rows={view.allies.opponents} total={view.allies.opponentCount} />
		</section>
	</div>
{/if}

{#if view.matches.length > 0}
	<section class="panel" aria-labelledby="matches-title">
		<h2 class="sec-title" id="matches-title">Matches</h2>
		<TeamMatches events={view.matches} team={view.team.number} />
	</section>
{/if}

{#if view.previous}
	<section class="panel previous" aria-labelledby="previous-title">
		<h2 class="sec-title" id="previous-title">{previousTitle}</h2>
		<LastSeason previous={view.previous} />
	</section>
{/if}

<TeamBadges number={view.team.number} name={view.team.name} />

<style>
	.summary {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 18px;
		padding-bottom: 26px;
		border-bottom: 1px solid var(--line);
	}

	.team-actions {
		display: flex;
		flex: 1 1 auto;
		flex-wrap: wrap;
		gap: 8px;
	}

	.team-actions > :global(:first-child) {
		min-width: 7em;
	}

	.pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-columns);
		align-items: start;
	}

	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-title);
		align-content: start;
		min-width: 0;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 16px;
	}

	.head a {
		font-size: 13px;
		color: var(--text-2);
	}

	.head a:hover {
		color: var(--text);
	}

	.previous {
		max-width: 520px;
	}

	.awards {
		max-width: 720px;
	}

	@media (max-width: 1060px) {
		.pair {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 600px) {
		.team-actions {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.team-actions > :global(*) {
			min-width: 0;
		}
	}

	@media (pointer: coarse) {
		.head a {
			display: inline-block;
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
