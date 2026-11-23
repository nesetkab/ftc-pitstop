<script lang="ts">
	import { oprTerm } from '#lib/format/glossary.ts';
	import { fixed, integer } from '#lib/format/index.ts';
	import { PART_LABELS } from '#lib/game/biobuzz.ts';
	import ProbCell from '#lib/ui/ProbCell.svelte';
	import Table from '#lib/ui/Table.svelte';
	import Term from '#lib/ui/Term.svelte';
	import { LEAD_SHARE, partLead, type Alliance, type Fit, type FitPart } from './fit.ts';

	interface Props {
		fit: Fit;
	}

	let { fit }: Props = $props();

	const ROWS: { part: FitPart; label: string; term: string; nested?: boolean; count?: boolean }[] =
		[
			{ part: 'auto', label: PART_LABELS.auto, term: oprTerm(PART_LABELS.auto) },
			{ part: 'teleop', label: PART_LABELS.teleop, term: oprTerm(PART_LABELS.teleop) },
			{ part: 'hive', label: PART_LABELS.hive, term: oprTerm(PART_LABELS.hive), nested: true },
			{
				part: 'flower',
				label: PART_LABELS.flower,
				term: oprTerm(PART_LABELS.flower),
				nested: true
			},
			{
				part: 'garden',
				label: PART_LABELS.garden,
				term: oprTerm(PART_LABELS.garden),
				nested: true
			},
			{ part: 'park', label: PART_LABELS.park, term: oprTerm(PART_LABELS.park), nested: true },
			{ part: 'leavePark', label: 'Leave and park', term: 'Leave and park' },
			{ part: 'tips', label: PART_LABELS.tips, term: oprTerm(PART_LABELS.tips), count: true }
		];

	const best = $derived(fit.alliances[0] ?? null);
	const pairName = (alliance: Alliance) => alliance.teams.join(' + ');
	const averagePair = (part: FitPart) => fit.average[part] * 2;
	const averageScore = $derived(averagePair('auto') + averagePair('teleop'));

	function leader(alliance: Alliance, part: FitPart): string | null {
		const members = fit.teams.filter((team) => alliance.teams.includes(team.number));
		return partLead(members, part, alliance.score);
	}
</script>

{#if best}
	<p class="lead">
		{#if fit.alliances.length === 1}
			Together, {pairName(best)} would be expected to score about
			<b>{integer(best.score)}</b> points per match before penalties.
		{:else}
			{pairName(best)} is the strongest pair, at about <b>{integer(best.score)}</b> points per match before
			penalties.
		{/if}
	</p>

	<div class="wrap">
		<Table>
			<caption class="visually-hidden"
				>Predicted score and ranking point chances for each pair</caption
			>
			<thead>
				<tr>
					<th class="l pin" scope="col">Alliance</th>
					<th scope="col"><Term label="Pred." /></th>
					<th scope="col"><Term label="Swarm" /></th>
					<th scope="col"><Term label="Poll. 1" /></th>
					<th scope="col"><Term label="Poll. 2" /></th>
				</tr>
			</thead>
			<tbody>
				{#each fit.alliances as alliance (pairName(alliance))}
					<tr>
						<th class="l pin pair" scope="row">{pairName(alliance)}</th>
						<td class="score">{integer(alliance.score)}</td>
						<ProbCell p={alliance.chances.swarm} />
						<ProbCell p={alliance.chances.pollinator1} />
						<ProbCell p={alliance.chances.pollinator2} />
					</tr>
				{/each}
			</tbody>
		</Table>
	</div>

	<div class="wrap">
		<Table>
			<caption class="visually-hidden"
				>Points by part for each pair, against an average pair</caption
			>
			<thead>
				<tr>
					<th class="l pin" scope="col">Part</th>
					{#each fit.alliances as alliance (pairName(alliance))}
						<th scope="col">{pairName(alliance)}</th>
					{/each}
					<th scope="col">Average pair</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<th class="l pin part" scope="row">Total</th>
					{#each fit.alliances as alliance (pairName(alliance))}
						<td class="score">{fixed(alliance.score)}</td>
					{/each}
					<td class="dim">{fixed(averageScore)}</td>
				</tr>
				{#each ROWS as row (row.part)}
					<tr class:nested={row.nested}>
						<th class="l pin part" scope="row"><Term label={row.label} term={row.term} /></th>
						{#each fit.alliances as alliance (pairName(alliance))}
							{@const lead = leader(alliance, row.part)}
							<td>
								<span class="value">{fixed(alliance.parts[row.part])}</span>
								{#if lead}
									<span class="sub">{lead}</span>
								{/if}
							</td>
						{/each}
						<td class="dim">{fixed(averagePair(row.part))}</td>
					</tr>
				{/each}
			</tbody>
		</Table>
	</div>

	{#if fit.notes.length > 0}
		<ul class="notes">
			{#each fit.notes as note (note)}
				<li>{note}</li>
			{/each}
		</ul>
	{/if}
{/if}

<p class="note">
	As if these teams met at a new event today, before penalties. Chances are for one match. A team's
	share shows when it brings {LEAD_SHARE * 100}% or more of a part.
	{#if fit.missing.length > 0}
		No season rating yet for {fit.missing.join(', ')}.
	{/if}
</p>

<style>
	.lead {
		max-width: 68ch;
		margin: 0;
		font-size: 15px;
		color: var(--text);
	}

	.lead b {
		font-variant-numeric: tabular-nums;
	}

	.wrap {
		min-width: 0;
	}

	.wrap + .wrap {
		margin-top: 12px;
	}

	.pin {
		position: sticky;
		left: 0;
		z-index: 1;
		background: var(--bg);
	}

	th.pair,
	th.part {
		vertical-align: top;
		padding: 9px 10px;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		color: var(--text);
	}

	th.pair {
		font-weight: 600;
	}

	th.part {
		font-weight: 400;
	}

	tr.nested th.part {
		padding-left: 24px;
		color: var(--text-2);
	}

	.score {
		font-weight: 600;
	}

	td {
		vertical-align: top;
	}

	.value,
	.sub {
		display: block;
	}

	.sub {
		font-size: 12.5px;
		color: var(--text-3);
	}

	.notes {
		display: grid;
		gap: 4px;
		max-width: 68ch;
		margin: 0;
		padding-left: 18px;
		font-size: 14px;
		color: var(--text);
	}

	@media (max-width: 600px) {
		.pin {
			box-shadow: inset -1px 0 var(--line);
		}

		th.pair,
		th.part {
			min-width: 84px;
			padding-inline: 6px;
			white-space: normal;
		}

		tr.nested th.part {
			padding-left: 12px;
		}
	}
</style>
