<script lang="ts">
	import { fixed } from '#lib/format/number.ts';
	import { ordinal } from '#lib/format/ordinal.ts';
	import { pct } from '#lib/format/pct.ts';
	import { RP_THRESHOLDS } from '#lib/game/biobuzz.ts';
	import Table from '#lib/ui/Table.svelte';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import {
		BRIEF_LABELS,
		BRIEF_PARTS,
		stakeText,
		type BriefPart,
		type MatchBrief,
		type StakeLine
	} from './brief.ts';
	import { colorName } from './copy.ts';

	interface Props {
		brief: MatchBrief;
		stake: StakeLine | null;
		href: (team: number) => string;
	}

	let { brief, stake, href }: Props = $props();

	const digits = (part: BriefPart) => (part === 'tips' ? 1 : 0);
	const sides = $derived([
		{ side: brief.ours, title: 'Us' },
		{ side: brief.theirs, title: 'Them' }
	]);
	const rp = $derived(brief.ours.rp);
	const chances = $derived(
		rp
			? [
					{ label: 'Win', value: rp.win },
					{ label: `Swarm, ${RP_THRESHOLDS.swarm}+`, value: rp.swarm },
					{ label: `Pollinator 1, ${RP_THRESHOLDS.pollinator1}+ tips`, value: rp.pollinator1 },
					{ label: `Pollinator 2, ${RP_THRESHOLDS.pollinator2}+ tips`, value: rp.pollinator2 }
				]
			: []
	);
</script>

<section class="brief" aria-label="Match brief for {brief.label}">
	{#if brief.notes.length > 0}
		<ul class="notes">
			{#each brief.notes as note (note)}
				<li>{note}</li>
			{/each}
		</ul>
	{/if}

	<Table class="parts">
		<caption class="visually-hidden">Scoring by part for {brief.label}</caption>
		<thead>
			<tr>
				<th class="l" scope="col">Team</th>
				{#each BRIEF_PARTS as part (part)}
					<th scope="col">{BRIEF_LABELS[part]}</th>
				{/each}
			</tr>
		</thead>
		{#each sides as { side, title } (side.color)}
			<tbody>
				{#each side.teams as team (team.number)}
					<tr>
						<td class="team">
							<TeamChip
								number={team.number}
								alliance={side.color}
								me={team.me}
								href={href(team.number)}
							/>
							{#if team.rank !== null}<small>{ordinal(team.rank)}</small>{/if}
						</td>
						{#each BRIEF_PARTS as part (part)}
							<td class={{ best: team.best.includes(part) }}>
								{team.values ? fixed(team.values[part], digits(part)) : '—'}
							</td>
						{/each}
					</tr>
				{/each}
				{#if side.totals}
					<tr class="total">
						<td class="team">
							<span class={['side', side.color]}>{title}</span>
							<span class="visually-hidden">{colorName(side.color)} alliance total</span>
						</td>
						{#each BRIEF_PARTS as part (part)}
							<td>{fixed(side.totals[part], digits(part))}</td>
						{/each}
					</tr>
				{/if}
			</tbody>
		{/each}
	</Table>

	{#if chances.length > 0 && rp}
		<div class="rp">
			<h3>Our ranking point chances</h3>
			<dl>
				{#each chances as chance (chance.label)}
					<div>
						<dt>{chance.label}</dt>
						<dd>{pct(chance.value)}</dd>
					</div>
				{/each}
			</dl>
			<p class="note">About {fixed(rp.expected, 1)} ranking points expected.</p>
		</div>
	{/if}

	{#if stake}
		<p class="stake">{stakeText(stake)}</p>
	{/if}

	<p class="note">Bold marks the best on the field. Tap a team for its full report.</p>
</section>

<style>
	.brief {
		display: grid;
		gap: 14px;
	}

	.notes {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 15px;
	}

	.notes li {
		padding-left: 12px;
		border-left: 2px solid var(--line-2);
	}

	.brief :global(.parts td),
	.brief :global(.parts th) {
		padding-inline: 6px;
	}

	.brief :global(.parts td:first-child),
	.brief :global(.parts th:first-child) {
		padding-left: 0;
	}

	.brief :global(.parts td:last-child),
	.brief :global(.parts th:last-child) {
		padding-right: 0;
	}

	.team small {
		margin-left: 6px;
		font-size: 12px;
		color: var(--text-3);
	}

	td.best {
		font-weight: 700;
	}

	tr.total td {
		color: var(--text-2);
		font-size: 13px;
	}

	.side {
		font-weight: 600;
	}

	.side.red {
		color: var(--red);
	}

	.side.blue {
		color: var(--blue);
	}

	.rp {
		display: grid;
		gap: 8px;
	}

	h3 {
		font-size: 14px;
		font-weight: 600;
	}

	dl {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px 16px;
		margin: 0;
	}

	dl div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--line);
	}

	dt {
		font-size: 13px;
		color: var(--text-2);
	}

	dd {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.stake {
		font-size: 15px;
	}
</style>
