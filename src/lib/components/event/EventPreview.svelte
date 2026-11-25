<script lang="ts">
	import Term from '#lib/ui/Term.svelte';
	import type { Projection, TeamRating } from '#lib/analysis/types.ts';
	import { SEASON } from '#lib/game/biobuzz.ts';
	import { fixed, integer } from '#lib/format/number.ts';
	import { allianceCountFor } from '#lib/model/bracket.ts';
	import { time } from '#lib/format/time.ts';
	import type { Match, Team } from '#lib/types.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import ProbCell from '#lib/ui/ProbCell.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import { weekday } from './dates.ts';
	import { placeName } from '#lib/format/places.ts';
	import RangeBar from './RangeBar.svelte';
	import Legend from '#lib/ui/Legend.svelte';

	type RatingWithRange = TeamRating & { sd?: number };

	interface Props {
		code: string;
		teams: Team[];
		matches: Match[];
		timezone: string;
		ratings?: TeamRating[] | null;
		projections?: Projection[] | null;
		followed?: ReadonlySet<number>;
	}

	let {
		code,
		teams,
		matches,
		timezone,
		ratings = null,
		projections = null,
		followed = new Set()
	}: Props = $props();

	const Z = 1.2816;

	const quals = $derived(matches.filter((match) => match.level === 'qual'));
	const first = $derived(
		quals.reduce<number | null>(
			(earliest, match) =>
				match.scheduledTime !== null && (earliest === null || match.scheduledTime < earliest)
					? match.scheduledTime
					: earliest,
			null
		)
	);
	const scheduleLine = $derived(
		first === null
			? `${integer(quals.length)} matches are scheduled.`
			: `${integer(quals.length)} matches are scheduled, starting ${weekday(first, timezone)} at ${time(first, timezone)}.`
	);
	const rated = $derived(
		ratings && ratings.length > 0
			? new Map(ratings.map((rating) => [rating.team, rating as RatingWithRange]))
			: null
	);
	const withRange = $derived(
		rated !== null && [...rated.values()].some((rating) => Number.isFinite(rating.sd))
	);
	const projected = $derived(
		rated && projections && projections.length > 0
			? new Map(projections.map((projection) => [projection.team, projection]))
			: null
	);
	const spots = $derived(allianceCountFor(projected?.size ?? 0));
	const rows = $derived.by(() => {
		const list = teams.map((team) => ({
			team,
			rating: rated?.get(team.number) ?? null,
			projection: projected?.get(team.number) ?? null
		}));
		if (!rated) return list.sort((a, b) => a.team.number - b.team.number);
		return list.sort(
			(a, b) =>
				(a.projection?.expectedRank ?? Number.POSITIVE_INFINITY) -
					(b.projection?.expectedRank ?? Number.POSITIVE_INFINITY) ||
				(b.rating?.opr ?? Number.NEGATIVE_INFINITY) - (a.rating?.opr ?? Number.NEGATIVE_INFINITY) ||
				a.team.number - b.team.number
		);
	});

	function topChance(projection: Projection): number {
		return projection.rankChances.slice(0, spots).reduce((total, p) => total + p, 0);
	}
	const scale = $derived(
		Math.max(
			1,
			...rows.map((row) => (row.rating ? (range(row.rating)?.high ?? row.rating.opr) : 0))
		)
	);

	function basis(team: Team, rating: RatingWithRange): string {
		if (rating.matches > 0) {
			return `${integer(rating.matches)} BIOBUZZ ${rating.matches === 1 ? 'match' : 'matches'}`;
		}
		if (team.rookieYear === SEASON) return 'Rookie team';
		return 'Last season';
	}

	function range(rating: RatingWithRange) {
		const sd = rating.sd;
		if (sd === undefined || !Number.isFinite(sd)) return null;
		return { low: Math.max(0, rating.opr - Z * sd), high: rating.opr + Z * sd };
	}
</script>

{#if quals.length === 0}
	<EmptyState title="The match schedule hasn't been posted yet.">
		This page and your pit display fill in on their own once it is.
	</EmptyState>
{:else}
	<EmptyState title="Qualification matches haven't started yet.">
		{scheduleLine} <a href="/events/{code}/schedule">See the schedule</a>.
	</EmptyState>
{/if}

{#if teams.length === 0}
	<p class="muted">No teams have registered yet.</p>
{:else}
	<Table>
		<caption class="visually-hidden">Teams at this event</caption>
		<thead>
			<tr>
				{#if rated}<th class="l" scope="col">#</th>{/if}
				<th class="l" scope="col">Team</th>
				{#if rated}
					<th scope="col"><Term label="Starting OPR" /></th>
					{#if withRange}
						<th scope="col">Likely range</th>
					{/if}
					<th class="l opt" scope="col">Based on</th>
					{#if projected}
						<th class="sep" scope="col">Expected rank</th>
						{#if spots > 0}
							<th scope="col">Top {spots}</th>
						{/if}
					{/if}
				{:else}
					<th class="l" scope="col">Location</th>
					<th scope="col">Rookie year</th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each rows as row, index (row.team.number)}
				<tr class:me={followed.has(row.team.number)}>
					{#if rated}<td class="l">{index + 1}</td>{/if}
					<td class="team">
						<TeamCell
							number={row.team.number}
							name={row.team.name}
							href="/teams/{row.team.number}"
						/>
					</td>
					{#if rated}
						{#if row.rating}
							{@const spread = range(row.rating)}
							<td>{fixed(row.rating.opr)}</td>
							{#if withRange}
								<td>
									{#if spread}
										<RangeBar
											low={spread.low}
											high={spread.high}
											value={row.rating.opr}
											max={scale}
										/>
									{/if}
								</td>
							{/if}
							<td class="l muted opt">{basis(row.team, row.rating)}</td>
						{:else}
							<td>—</td>
							{#if withRange}
								<td></td>
							{/if}
							<td class="l muted opt">No rating yet</td>
						{/if}
						{#if projected}
							<td class="sep">{fixed(row.projection?.expectedRank)}</td>
							{#if spots > 0}
								<ProbCell p={row.projection ? topChance(row.projection) : null} />
							{/if}
						{/if}
					{:else}
						<td class="l muted">{placeName(row.team, 'short')}</td>
						<td>{row.team.rookieYear ?? '—'}</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</Table>
	{#if rated}
		<Legend>
			Starting OPR is the rating each team brings into this event. Teams with BIOBUZZ matches start
			from their own results. Teams without start from last season's results.
			{#if projected && spots > 0}
				Expected rank and top {spots} chance play out the posted schedule thousands of times, so they
				also reflect who each team is paired with and against. The top {spots} become alliance captains.
			{/if}
		</Legend>
	{/if}
{/if}
