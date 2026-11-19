<script lang="ts">
	import { dateRange, time } from '#lib/format/time.ts';
	import type { Event } from '#lib/types.ts';
	import MatchList from '#lib/ui/MatchList.svelte';
	import QrCode from './QrCode.svelte';
	import { colorName, matchItems } from './copy.ts';
	import type { PitView } from './view.ts';

	interface Props {
		view: PitView;
		event: Event;
		phoneUrl: string;
	}

	let { view, event, phoneUrl }: Props = $props();

	const first = $derived(view.firstMatch);
	const where = $derived(
		[event.venue, [event.city, event.state].filter(Boolean).join(', ')].filter(Boolean).join(', ')
	);
</script>

<div class="cols" style:--cols="31em minmax(0, 1fr) 21em">
	<section>
		<span class="tv-label">{dateRange(event.start, event.end)}</span>
		<div class="team">
			<b>{view.team}</b>
			{#if view.teamName}<span>{view.teamName}</span>{/if}
		</div>
		<p class="event">{event.name}</p>
		{#if where}<p class="sub">{where}</p>{/if}
		<div class="first">
			{#if first}<span class="tv-label">First match</span>{/if}
			{#if first && first.scheduled !== null}
				<b>{first.label} at {time(first.scheduled, event.timezone)}</b>
				<span>
					{colorName(first.alliance)} alliance{first.partners.length > 0
						? ` with ${first.partners.join(', ')}`
						: ''}.
				</span>
			{:else if first}
				<b>{first.label}</b>
			{:else}
				<b>The match schedule hasn't been posted yet.</b>
				<span>This screen fills in on its own once it is.</span>
			{/if}
		</div>
	</section>
	<section>
		<span class="tv-label">Our matches</span>
		{#if view.matches.length > 0}
			<MatchList items={matchItems(view.matches, first?.key ?? null, event.timezone, 10)} />
		{:else}
			<p class="sub">Our matches show up here when the schedule is posted.</p>
		{/if}
		{#if view.startsAt !== null}
			<p class="sub">
				Matches start at {time(view.startsAt, event.timezone)}. {view.qualsTotal} qualification matches
				in all.
			</p>
		{/if}
	</section>
	<section class="phone">
		<div class="code">
			<QrCode text={`https://${phoneUrl}`} label={`QR code for ${phoneUrl}`} />
		</div>
		<p class="sub">Open on your phone</p>
		<p class="url">{phoneUrl}</p>
	</section>
</div>

<style>
	.team {
		display: grid;
		gap: 0.3em;
	}

	.team b {
		font-size: 6.4em;
		line-height: 0.95;
		font-weight: 650;
		letter-spacing: -0.03em;
	}

	.team span {
		font-size: 1.6em;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.event {
		font-size: 1.2em;
		font-weight: 500;
	}

	.sub {
		font-size: 0.9em;
		color: var(--text-2);
	}

	.first {
		display: grid;
		gap: 0.3em;
		margin-top: 0.6em;
	}

	.first b {
		font-size: 2.4em;
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.first span {
		font-size: 0.9em;
		color: var(--text-2);
	}

	.phone {
		justify-items: start;
	}

	.code {
		width: 14em;
	}

	.url {
		font-size: 1.6em;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
</style>
