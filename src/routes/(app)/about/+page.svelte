<script lang="ts">
	import { page } from '$app/state';
	import {
		ABOUT_DESCRIPTION,
		ABOUT_SECTIONS,
		ABOUT_TITLE,
		type AboutSectionId
	} from '#lib/components/about/sections.ts';
	import { DEEP, TOP } from '#lib/components/event/strength.ts';
	import { BUNDLE_INTERVAL, QUEUE_INTERVAL } from '#lib/components/pit/poll.ts';
	import { QUEUE_EARLIEST, QUEUE_MATCHES_AHEAD } from '#lib/components/pit/queue.ts';
	import { GLOSSARY, termId } from '#lib/format/glossary.ts';
	import { fixed, integer } from '#lib/format/number.ts';
	import { GAME_NAME, RP_THRESHOLDS } from '#lib/game/biobuzz.ts';
	import { WIN_PARAMS } from '#lib/model/predict.ts';
	import { RP_RULES } from '#lib/model/rp.ts';
	import { PLAUSIBLE_SCORE } from '#lib/model/types.ts';
	import { articleJsonLd, siteTitle } from '#lib/seo.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';

	const SIMULATIONS = 10_000;
	const BONUS_POINTS = 3;
	const AHEAD_WORDS = ['zero', 'one', 'two', 'three', 'four'];

	const glossary = Object.entries(GLOSSARY);
	const maxRp = RP_RULES.win + BONUS_POINTS;
	const tieChance = fixed(WIN_PARAMS.tie * 100);
	const queueLead = QUEUE_EARLIEST / 60_000;
	const titles = new Map<AboutSectionId, string>(
		ABOUT_SECTIONS.map((section) => [section.id, section.title])
	);
	const order = new Map<AboutSectionId, string>(
		ABOUT_SECTIONS.map((section, index) => [section.id, String(index + 1).padStart(2, '0')])
	);

	let current = $state<AboutSectionId>(ABOUT_SECTIONS[0].id);

	$effect(() => {
		if (typeof IntersectionObserver === 'undefined') return;
		const visible: Record<string, boolean> = {};
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					visible[entry.target.id] = entry.isIntersecting;
				}
				const first = ABOUT_SECTIONS.find((section) => visible[section.id]);
				if (first) current = first.id;
			},
			{ rootMargin: '0px 0px -70% 0px' }
		);
		for (const section of ABOUT_SECTIONS) {
			const element = document.getElementById(section.id);
			if (element) observer.observe(element);
		}
		return () => observer.disconnect();
	});
</script>

<Seo
	title={siteTitle('How PitStop’s FTC numbers work')}
	description={ABOUT_DESCRIPTION}
	path="/about"
	data={[
		articleJsonLd(page.url.origin, {
			path: '/about',
			headline: ABOUT_TITLE,
			description: ABOUT_DESCRIPTION,
			sections: ABOUT_SECTIONS.map((section) => section.title)
		})
	]}
/>

{#snippet heading(id: AboutSectionId)}
	<h2 id="{id}-title">
		<span class="index n" aria-hidden="true">{order.get(id)}</span>
		<a href="#{id}">{titles.get(id)}</a>
	</h2>
{/snippet}

<PageHeader
	title={ABOUT_TITLE}
	meta="What every number on PitStop means, how it is worked out, where the data comes from and where it falls short."
/>

<div class="about">
	<nav class="toc" aria-label="On this page">
		<p class="toc-title">On this page</p>
		<ol>
			{#each ABOUT_SECTIONS as section (section.id)}
				<li>
					<a
						href="#{section.id}"
						aria-current={current === section.id ? 'location' : undefined}
						onclick={() => (current = section.id)}>{section.title}</a
					>
				</li>
			{/each}
		</ol>
	</nav>

	<article>
		<section id="opr" aria-labelledby="opr-title">
			{@render heading('opr')}
			<p>
				OPR, short for offensive power rating, is an estimate of how many points a team adds to its
				alliance’s score in a typical match. It is the number most of PitStop is built on.
			</p>
			<p>
				FTC only reports scores per alliance, never per robot, so OPR works backwards. Across every
				match at an event, it finds the set of team numbers that best explains all the alliance
				scores at once. Each team’s number is its OPR. PitStop leaves penalty points out, so a team
				gets no credit for fouls the other alliance committed.
			</p>
			<p>
				A handful of matches is not enough to tell teams apart, so each team starts from a guess
				based on its earlier events this season and how it finished last season. The matches at the
				current event take over quickly. Older information counts for less, and less again for a
				team that has been away for weeks, because robots change between events.
			</p>
			<p>
				That is why PitStop’s OPR will not match FTCScout’s exactly. FTCScout shows the classic
				version, solved from qualification matches alone with no starting guess. PitStop also counts
				playoff matches. Both leave penalty points out. Checked on nine finished events in November
				2026, the two agreed on average, within 3 points either way, but a single team typically
				differed by 2 to 7 points, and by up to 30 when its starting guess or its playoff matches
				told a different story than its qualification matches.
			</p>
			<p>
				PitStop uses OPR because it tested best. Every traditional FTC event from 2021 to 2026 was
				replayed, predicting each match from only the matches before it. OPR with these starting
				guesses beat every alternative tried, including several versions of EPA, in every season.
				The <a href="/accuracy">accuracy page</a> has the full results.
			</p>
			<p>
				The same method runs on each part of the score, which gives auto OPR, hive OPR, tips OPR and
				the rest. Each part is solved on its own, so the parts will not always add up to total OPR
				exactly. Every variant is listed in the <a href="#glossary">glossary</a>.
			</p>
		</section>

		<section id="rankings" aria-labelledby="rankings-title">
			{@render heading('rankings')}
			<p>
				Official rankings come straight from FIRST. PitStop does not reorder them.
				<dfn>RS</dfn>, the ranking score, is a team’s average ranking points per match, and it
				decides the order. <dfn>TBP</dfn>, tiebreaker points, is the average match score without
				penalties, and it separates teams with the same RS. A match a team was disqualified from or
				did not show up for counts as zero for both.
			</p>
			<p>
				League meets show league rankings, which use each team’s best 10 league matches so far.
				There RS and TBP are totals over those matches divided by 10, so they start low and climb as
				the league goes on. The record counts the same matches.
			</p>
			<p>
				When FIRST’s rankings are down and PitStop falls back to FTCScout, it works the rankings out
				from the match results with FIRST’s rules, so disqualified and missed matches still count as
				zero. Only the current event is loaded then, so after a league’s first meet those rankings
				leave out earlier meets and show plain per-match averages.
			</p>
			<p>
				On team pages, the season record adds up qualification matches from every event. Playoff
				matches are not counted.
			</p>
			<p>
				<dfn>NP</dfn> means non-penalty: an alliance’s score with the other alliance’s foul points taken
				out. NP avg, NP max and NP min describe the scores of the alliances a team played on, and spread
				shows how much those scores move around from match to match. A high NP avg with a small spread
				is a team you can count on.
			</p>
		</section>

		<section id="ranking-points" aria-labelledby="ranking-points-title">
			{@render heading('ranking-points')}
			<p>In {GAME_NAME} qualification matches, each team on an alliance earns:</p>
			<dl class="rules">
				<div>
					<dt>Win or tie</dt>
					<dd>{RP_RULES.win} for a win, {RP_RULES.tie} for a tie</dd>
				</div>
				<div>
					<dt>Swarm</dt>
					<dd>1 when the alliance scores {RP_THRESHOLDS.swarm} or more leave and park points</dd>
				</div>
				<div>
					<dt>Pollinator 1</dt>
					<dd>1 when the alliance makes {RP_THRESHOLDS.pollinator1} or more hive tips</dd>
				</div>
				<div>
					<dt>Pollinator 2</dt>
					<dd>1 more when the alliance makes {RP_THRESHOLDS.pollinator2} or more hive tips</dd>
				</div>
			</dl>
			<p>
				That is at most {maxRp} ranking points per match. PitStop predicts each bonus before the match.
				The Swarm chance combines each robot’s record of leaving and parking with the alliance’s predicted
				leave and park points. The Pollinator chances treat tips OPR as an expected count and ask how
				likely the alliance is to reach each threshold. Both were checked against this season’s results,
				and the <a href="/accuracy">accuracy page</a> shows how close they came.
			</p>
		</section>

		<section id="predictions" aria-labelledby="predictions-title">
			{@render heading('predictions')}
			<p>
				For a match that has not been played, each alliance’s predicted score adds up its two teams’
				OPRs, shifts them up or down for how high-scoring the event has been, and adds the foul
				points the other alliance tends to give away.
			</p>
			<p>
				The win chance comes from the gap between the two alliances’ ratings, turned into a
				percentage by an S-shaped curve fitted to five past seasons. The curve stays closer to 50/50
				when the teams have played only a few matches at the event, or when the model is unsure
				about them for other reasons. An evenly matched game has about a {tieChance}% chance of a
				tie.
			</p>
			<p>
				A 70% win chance means the favorite should lose about 3 times in 10. Upsets are expected,
				not mistakes. Replayed on past seasons, the predicted chances lined up with how often teams
				actually won to within a few percentage points.
			</p>
			<p>
				Teams with no history this season are treated as weaker than average when picking a winner,
				because that is what the past data shows. For predicted points, a separate estimate without
				that penalty is used, so new teams’ scores do not come out too low.
			</p>
			<p>
				Rank projections and playoff odds play out the rest of the schedule {integer(SIMULATIONS)}
				times using these chances, then count how often each team lands in each spot.
			</p>
		</section>

		<section id="match-impact" aria-labelledby="match-impact-title">
			{@render heading('match-impact')}
			<h3>What’s at stake</h3>
			<p>
				Shown on upcoming qualification matches at events with playoffs. For each team in the match,
				it gives the chance to finish high enough to be an alliance captain: as things stand now, if
				they win, and if they lose. PitStop gets these by playing out the rest of the qualification
				schedule many times, once with this match forced to each result. The wider the gap between
				the win and loss numbers, the more the match matters to that team.
			</p>
			<h3>What this match changed</h3>
			<p>
				Shown on played qualification matches. It lists each team’s rank and OPR just before and
				just after the match, so you can see who moved and by how much.
			</p>
		</section>

		<section id="queue-times" aria-labelledby="queue-times-title">
			{@render heading('queue-times')}
			<p>
				Events rarely run to the printed schedule. PitStop estimates when each match will start from
				how the event is actually running: it measures the gaps between the last several matches
				played, ignores breaks, and moves the rest of the schedule along at that pace. Scheduled
				breaks, like lunch and overnight, are kept.
			</p>
			<p>
				Your queue time is the estimated start of the match {AHEAD_WORDS[QUEUE_MATCHES_AHEAD] ??
					QUEUE_MATCHES_AHEAD}
				before yours, but never more than {queueLead} minutes before your own match is expected to start.
				At events that use Nexus for queueing, Nexus’s own queue times and calls, like now queuing and
				on deck, come first.
			</p>
			<p>
				The <a href="/accuracy">accuracy page</a> shows how close the start time estimates came on this
				season’s events, next to the printed schedule.
			</p>
		</section>

		<section id="event-strength" aria-labelledby="event-strength-title">
			{@render heading('event-strength')}
			<p>
				<dfn>Strength</dfn> is how tough an event’s field is: the average season OPR of the {TOP} best
				rated teams there. The top of the field decides who wins and advances, so a few strong teams count
				for more than a long tail of new ones.
			</p>
			<p>
				Before and during an event, it uses every registered team. Once the event is over, it uses
				only the teams that played. Every team is measured by its current season OPR, so a past
				event’s strength moves as its teams improve. Teams with no matches yet have no OPR and are
				left out.
			</p>
			<p>
				An event needs at least {TOP} rated teams to get a strength. The
				<a href="/events/strength">strongest events</a> page ranks every event this season, and also
				shows the top {DEEP} average and the average over every rated team.
			</p>
		</section>

		<section id="sources" aria-labelledby="sources-title">
			{@render heading('sources')}
			<dl class="rules">
				<div>
					<dt><a href="https://ftc-events.firstinspires.org">FIRST FTC Events</a></dt>
					<dd>
						The official source for events, teams, schedules, scores, rankings, alliances and
						awards.
					</dd>
				</div>
				<div>
					<dt><a href="https://ftcscout.org">FTCScout</a></dt>
					<dd>
						Season-wide match history behind season OPR and world ranks, the season’s event list,
						and a backup when the FIRST API is slow or down. Event pages say when they are showing
						FTCScout data.
					</dd>
				</div>
				<div>
					<dt><a href="https://ftc.nexus">Nexus</a></dt>
					<dd>Live queueing status, at events that use it.</dd>
				</div>
			</dl>
			<p>
				During a live event, PitStop checks FIRST for new scores and rankings every 15 to 20
				seconds, and open event pages refresh themselves every 30 seconds. Pit screens check for new
				results every {BUNDLE_INTERVAL / 1000} seconds and queue status every {QUEUE_INTERVAL /
					1000} seconds. Season ratings are rebuilt about once an hour. Scores appear once the event’s
				scorekeeper sends them to FIRST, so a short delay after a match ends is normal.
			</p>
			<p>
				Teams can show their numbers on a website or GitHub README with a badge, an image at
				<code>/badge/NUMBER.svg</code>. The Badges section at the bottom of each team page has
				copy-paste code. Badges are cached for up to an hour, so they can trail the team page a
				little.
			</p>
		</section>

		<section id="impossible-scores" aria-labelledby="impossible-scores-title">
			{@render heading('impossible-scores')}
			<p>
				Now and then a score is entered wrong. In one case a real match was recorded as 7,308 to
				8,355. Because OPR solves every match at an event together, a single bad score can throw off
				every team at that event, and even the season-wide numbers.
			</p>
			<p>
				So PitStop leaves a match out of its ratings and predictions when an alliance total is above
				{PLAUSIBLE_SCORE}, or when auto and teleop points do not add up to the non-penalty score.
				The match still appears in results with its official score. It just does not feed the model.
			</p>
		</section>

		<section id="limits" aria-labelledby="limits-title">
			{@render heading('limits')}
			<ul>
				<li>
					OPR assumes points simply add up. Defense, partners who work especially well or badly
					together, and one robot carrying an alliance all get spread across the teams involved.
				</li>
				<li>
					Early in an event, ratings lean on earlier events and last season. A team that rebuilt its
					robot will look off for its first few matches.
				</li>
				<li>
					Win chances ignore fouls. They were tested and turned out too random to predict per team.
				</li>
				<li>
					{GAME_NAME} is new this season, so ranking point chances, the tie rate and the score spread
					were fitted on this season’s matches alone. They will settle as more matches are played.
				</li>
				<li>
					Teams with no history are assumed to be weaker than average. That is usually right, but it
					undersells a strong first-year team until it has played a few matches.
				</li>
				<li>
					The numbers are only as good as what is entered at the event. Corrected scores show up on
					the next refresh.
				</li>
				<li>
					None of this is official. For official rankings, schedules and results, use
					<a href="https://ftc-events.firstinspires.org">FTC Events</a>.
				</li>
			</ul>
		</section>

		<section id="glossary" aria-labelledby="glossary-title">
			{@render heading('glossary')}
			<p>
				Every short label used in PitStop’s tables. Hover over one in a table to see it, or tap it
				to come here.
			</p>
			<dl class="glossary">
				{#each glossary as [term, text] (term)}
					<div id={termId(term)}>
						<dt>{term}</dt>
						<dd>{text}</dd>
					</div>
				{/each}
			</dl>
		</section>
	</article>
</div>

<style>
	.about {
		display: grid;
		grid-template-columns: 200px minmax(0, 70ch);
		gap: 64px;
		align-items: start;
		margin-top: 8px;
	}

	.toc {
		position: sticky;
		top: 24px;
		display: grid;
		gap: 10px;
		font-size: 14px;
	}

	.toc-title {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.toc ol {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		border-left: 1px solid var(--line);
	}

	.toc a {
		display: block;
		margin-left: -1px;
		padding: 5px 0 5px 14px;
		border-left: 1px solid transparent;
		color: var(--text-2);
		text-decoration: none;
	}

	.toc a:hover {
		color: var(--text);
	}

	.toc a[aria-current] {
		border-left-color: var(--text);
		color: var(--text);
		font-weight: 500;
	}

	article {
		display: grid;
		gap: 56px;
		font-size: 17px;
		line-height: 1.65;
	}

	section {
		display: grid;
		gap: 16px;
		scroll-margin-top: 24px;
	}

	section + section {
		padding-top: 40px;
		border-top: 1px solid var(--line);
	}

	h2 {
		display: grid;
		gap: 6px;
		font-size: 22px;
		line-height: 1.25;
	}

	h2 a {
		text-decoration: none;
	}

	h2 a:hover {
		text-decoration: underline;
	}

	.index {
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.04em;
		color: var(--text-3);
	}

	h3 {
		margin-top: 8px;
		font-size: 17px;
	}

	p,
	li {
		text-wrap: pretty;
	}

	dfn {
		font-style: normal;
		font-weight: 600;
	}

	ul {
		display: grid;
		gap: 10px;
		margin: 0;
		padding-left: 20px;
	}

	li::marker {
		color: var(--text-3);
	}

	.rules,
	.glossary {
		display: grid;
		margin: 0;
		border-top: 1px solid var(--line);
	}

	.rules div,
	.glossary div {
		display: grid;
		grid-template-columns: 11em minmax(0, 1fr);
		gap: 4px 20px;
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
	}

	.glossary {
		font-size: 15px;
		line-height: 1.5;
	}

	.glossary div {
		scroll-margin-top: 24px;
	}

	.glossary div:target {
		background: var(--surface);
		box-shadow:
			-8px 0 0 var(--surface),
			8px 0 0 var(--surface);
	}

	dt {
		font-weight: 600;
	}

	dd {
		color: var(--text-2);
	}

	@media (max-width: 1000px) {
		.about {
			grid-template-columns: minmax(0, 1fr);
			gap: 32px;
		}

		.toc {
			position: static;
			padding-bottom: 24px;
			border-bottom: 1px solid var(--line);
		}

		.toc ol {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			column-gap: 16px;
			border-left: none;
		}

		.toc a {
			margin-left: 0;
			padding: 6px 0;
			border-left: none;
		}

		.toc a[aria-current] {
			font-weight: 400;
			color: var(--text-2);
		}

		article {
			max-width: 70ch;
		}
	}

	@media (max-width: 600px) {
		article {
			font-size: 16px;
		}

		.rules div,
		.glossary div {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
