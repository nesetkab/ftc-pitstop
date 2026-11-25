<script lang="ts">
	import { page } from '$app/state';
	import {
		ABOUT_DESCRIPTION,
		ABOUT_SECTIONS,
		ABOUT_TITLE,
		type AboutSectionId
	} from '#lib/components/about/sections.ts';
	import { TOP } from '#lib/components/event/strength.ts';
	import { BUNDLE_INTERVAL } from '#lib/components/pit/poll.ts';
	import { QUEUE_EARLIEST, QUEUE_MATCHES_AHEAD } from '#lib/components/pit/queue.ts';
	import { GLOSSARY, oldTermId, termId } from '#lib/format/glossary.ts';
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
	<h2 id="{id}-title"><a href="#{id}">{titles.get(id)}</a></h2>
{/snippet}

<PageHeader title={ABOUT_TITLE} />

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
				aOPR, adjusted OPR, is PitStop’s version of OPR, short for offensive power rating. It is an
				estimate of how many points a team adds to its alliance’s score in a typical match.
			</p>
			<p>
				Most of the score is only reported per alliance, so aOPR works backwards. Across every
				match, it finds the set of team numbers that best explains all the alliance scores at once.
			</p>
			<p>
				<em>FIRST</em> records some points per robot, like leaving and parking. Each team gets those points
				directly, and only the rest of the score is split between partners.
			</p>
			<p>
				aOPR never goes below zero, because a team cannot take points away from its own alliance.
				That keeps a weak team with strong partners from being blamed for points it never cost them.
			</p>
			<p>
				A handful of matches is not enough to tell teams apart, so each team starts from a guess
				based on its earlier events this season and its last three seasons. The matches at the
				current event take over quickly. Older results count for less, because robots change between
				events.
			</p>
			<p>
				That is why aOPR will not match the OPR on FTCScout. FTCScout shows classic OPR, solved from
				qualification matches alone with no starting guess. PitStop also counts playoff matches,
				credits robot points directly and starts each team from a guess.
			</p>
			<p>
				PitStop uses this version because it predicted past matches best. Every traditional FTC
				event from 2021 to 2026 was replayed, predicting each match from only the matches before it.
				It beat PitStop’s earlier OPR model and several versions of EPA in every season. The
				<a href="/accuracy">accuracy page</a> has the full results.
			</p>
			<p>
				The same method runs on each part of the score, which gives auto aOPR, hive aOPR, tips aOPR
				and the rest. The point parts add up to total aOPR.
			</p>
		</section>

		<section id="rankings" aria-labelledby="rankings-title">
			{@render heading('rankings')}
			<p>
				Official rankings come straight from <em>FIRST</em>, and PitStop does not reorder them.
				<dfn>RS</dfn>, the ranking score, is a team’s average ranking points per match, and it
				decides the order. <dfn>TBP</dfn>, tiebreaker points, separates teams with the same RS. A
				match a team was disqualified from or did not show up for counts as zero for both.
			</p>
			<p>
				League meets use each team’s best 10 league matches so far. There RS and TBP are totals over
				those matches divided by 10, so they start low and climb as the league goes on.
			</p>
			<p>
				When <em>FIRST</em>’s rankings are down, PitStop works them out from the match results with
				<em>FIRST</em>’s rules.
			</p>
			<p>
				On team pages, the season record counts qualification matches from every event, but not
				playoffs.
			</p>
			<p>
				PitStop leaves out the points an alliance gets from the other alliance’s fouls, so a team
				gets no credit for its opponents’ mistakes. aOPR, TBP and <dfn>NP</dfn>, or non-penalty,
				scores all work this way. Predicted scores add back the foul points each opponent tends to
				give away, so they can be compared with the final score.
			</p>
			<p>
				NP avg, NP max and NP min describe the scores of the alliances a team played on, and spread
				shows how much those scores move from match to match. A high NP avg with a small spread is a
				team you can count on.
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
				The Swarm chance uses each robot’s record of leaving and parking. The Pollinator chances use the
				alliance’s tips aOPR. Both were fitted to this season’s results.
			</p>
		</section>

		<section id="predictions" aria-labelledby="predictions-title">
			{@render heading('predictions')}
			<p>
				For a match that has not been played, each alliance’s predicted score starts from its two
				teams’ aOPRs.
			</p>
			<p>
				A strong robot can carry a weaker partner, so an alliance with one much stronger team tends
				to score more than its two aOPRs add up to. PitStop adds a fifth of the gap between the two
				partners.
			</p>
			<p>
				The win chance comes from the gap between the two alliances’ ratings, fitted to the 2021 to
				2025 seasons. It stays closer to 50/50 early in an event, when the model knows less about
				the teams, and in high-scoring matches, where the same gap decides less. An evenly matched
				game has about a {tieChance}% chance of a tie.
			</p>
			<p>
				A 70% win chance means the favorite should lose about 3 times in 10. Upsets are expected,
				not mistakes.
			</p>
			<p>
				Teams with no history this season are treated as weaker than average when picking a winner,
				because that is what past seasons show. That undersells a strong first-year team until it
				has played a few matches.
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
				This shows on upcoming qualification matches at events with playoffs. For each team, it
				gives the chance to finish high enough to be an alliance captain as things stand, with a win
				and with a loss. The wider the gap between the win and loss numbers, the more the match
				matters to that team.
			</p>
			<h3>What this match changed</h3>
			<p>
				This shows on played qualification matches. It lists each team’s rank and aOPR just before
				and just after the match.
			</p>
		</section>

		<section id="queue-times" aria-labelledby="queue-times-title">
			{@render heading('queue-times')}
			<p>
				Events rarely run to the printed schedule. PitStop measures the gaps between the last
				several matches and moves the rest of the schedule along at that pace. Scheduled breaks,
				like lunch, are kept.
			</p>
			<p>
				Your queue time is the estimated start of the match {AHEAD_WORDS[QUEUE_MATCHES_AHEAD] ??
					QUEUE_MATCHES_AHEAD}
				before yours, but never more than {queueLead} minutes before your own match is expected to start.
				At events that use Nexus for queueing, Nexus’s own queue times and calls come first.
			</p>
		</section>

		<section id="event-strength" aria-labelledby="event-strength-title">
			{@render heading('event-strength')}
			<p>
				<dfn>Strength</dfn> is how tough an event’s field is: the average season aOPR of the {TOP} best
				rated teams there. The top of the field decides who wins and advances, so it counts for more than
				a long tail of new teams.
			</p>
			<p>
				Every team is measured by its current season aOPR, so a past event’s strength moves as its
				teams improve. Teams with no matches yet are left out.
			</p>
			<p>
				An event needs at least {TOP} rated teams to get a strength. The
				<a href="/events/strength">strongest events</a> page ranks every event this season.
			</p>
		</section>

		<section id="sources" aria-labelledby="sources-title">
			{@render heading('sources')}
			<dl class="rules">
				<div>
					<dt><a href="https://ftc-events.firstinspires.org">FTC Events</a></dt>
					<dd>
						The official source for events, teams, schedules, scores, rankings, alliances and
						awards.
					</dd>
				</div>
				<div>
					<dt><a href="https://ftcscout.org">FTCScout</a></dt>
					<dd>
						Season match history behind season aOPR and world ranks, and a backup when <em>FIRST</em
						> is slow or down.
					</dd>
				</div>
				<div>
					<dt><a href="https://ftc.nexus">Nexus</a></dt>
					<dd>Live queueing status, at events that use it.</dd>
				</div>
				<div>
					<dt>
						<a href="https://github.com/Pedro-Pathing/Visualizer">Pedro Pathing Visualizer</a>
					</dt>
					<dd>
						The field map on the strategy board, drawn by FTC Team Juice 16236 and shared under the
						<a href="/licenses/pedro-pathing-visualizer.txt">Apache License 2.0</a>.
					</dd>
				</div>
			</dl>
			<p>
				During a live event, event pages refresh every 30 seconds and pit screens every {BUNDLE_INTERVAL /
					1000} seconds. Season ratings are rebuilt about once an hour. Scores appear once the event’s
				scorekeeper sends them to <em>FIRST</em>, so a short delay after a match ends is normal.
			</p>
		</section>

		<section id="impossible-scores" aria-labelledby="impossible-scores-title">
			{@render heading('impossible-scores')}
			<p>
				Now and then a score is entered wrong. In one case a real match was recorded as 7,308 to
				8,355. Because aOPR solves every match at an event together, one bad score can throw off
				every team there.
			</p>
			<p>
				So PitStop leaves a match out of its ratings when an alliance total is above {PLAUSIBLE_SCORE},
				or when auto and teleop points do not add up to the NP score. The match still appears in
				results with its official score.
			</p>
		</section>

		<section id="limits" aria-labelledby="limits-title">
			{@render heading('limits')}
			<ul>
				<li>
					aOPR mostly assumes points add up. The one exception it handles is a strong robot carrying
					a weaker partner. Defense, and partners who work especially well or badly together, still
					get spread across the teams involved.
				</li>
				<li>
					Early in an event, ratings lean on earlier events and last season. A team that rebuilt its
					robot will look off for its first few matches.
				</li>
				<li>
					{GAME_NAME} is new, so ranking point chances and the tie rate were fitted on this season’s matches.
					They will settle as more matches are played.
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
			<p>Every short label used in PitStop’s tables.</p>
			<dl class="glossary">
				{#each glossary as [term, text] (term)}
					<div id={termId(term)}>
						<dt id={oldTermId(term)}>{term}</dt>
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
		grid-template-columns: 200px minmax(0, 72ch);
		gap: 72px;
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
		font-size: 13px;
		font-weight: 500;
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
		gap: 40px;
		font-size: 17px;
		line-height: 1.65;
	}

	section {
		display: grid;
		gap: 16px;
		scroll-margin-top: 24px;
	}

	section + section {
		padding-top: 36px;
		border-top: 1px solid var(--line);
	}

	h2 {
		font-size: 22px;
		line-height: 1.25;
	}

	h2 a {
		text-decoration: none;
	}

	h2 a:hover {
		text-decoration: underline;
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

	.glossary dt {
		scroll-margin-top: 34px;
	}

	.glossary div:is(:target, :has(> dt:target)) {
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

	@media (max-width: 1000px) and (pointer: coarse) {
		.toc a {
			padding-block: 10px;
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
