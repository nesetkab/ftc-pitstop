# PitStop

FTC stats, pit tools and scouting site. SvelteKit 3, Svelte 5, Vercel. See `HANDOFF.md` for the
stack, deploy steps, hard rules and the work queue.

## Writing site copy

Every word on the page costs the reader attention. Copy has two jobs: be easy for a person to read,
and carry the information they need. If a piece of information is not important to the reader,
leave it out.

### Rules

- **Say only what matters.** Before keeping a sentence, ask whether the reader would miss it. Most
  footnotes, method details, caveats and edge cases fail that test. Move method detail to the about
  page, or drop it.
- **Write whole sentences.** Cutting words is not the same as cutting length. Keep articles, verbs
  and connecting words, so a sentence reads naturally aloud. No telegraphic fragments, no stacked
  nouns, no clipped phrases like "Foul points left out."
- **One idea per sentence.** If a sentence needs a comma splice or two "and"s to hold together,
  split it or drop the weaker half.
- **Empty states are one short sentence.** Say what will appear here, not how it works.
- **Labels are plain words.** Use the word a team member would say at an event. No internal names,
  no jargon without a reason.
- **Don't explain the UI in the UI.** Don't add "click here", "tap to", "use this to" or URL
  instructions. If a control needs explaining, the control is wrong.
- **Don't repeat what the page already shows.** A heading, a number and a sentence saying the same
  thing is two too many.
- **Numbers need context only when the reader can't supply it.** "288" under "World record" needs
  no "points".
- **No hype or filler.** No "powerful", "seamless", "instantly", "simply", "just", "all in one
  place". No exclamation marks.
- **No method notes on data pages.** Don't explain how scores, fouls, penalties or ratings are
  counted under tables, in captions or in cards. That belongs on the about page only.
- **aOPR, not OPR,** for PitStop's own rating. "OPR" only for classic OPR or other sites' numbers.

### Examples

| Before                                                                                                                                                 | After                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| No events are running today. Events show here on the days they run, with live progress and the current leader.                                         | No events are running today. Live events show here.                                    |
| 288. 19666, 19641. M5 Red at China Shanghai #2 Qualifier, Nov 15. Against 27648 22406, who scored 188. Foul points left out. Tied by 1 other alliance. | 288. 19666, 19641. M5 Red at China Shanghai #2 Qualifier, Nov 15.                      |
| Pit display: Your next match, queue time and rank on the TV in your pit, updated live. Leave off /tv for the phone version.                            | Pit display: Your next match, queue time and rank on the TV in your pit, updated live. |
| (Note under a results table) Total, Opponent and Margin leave out points from fouls. Final adds them back.                                             | (Nothing. The columns speak for themselves; method detail belongs on the about page.)  |

### Checking copy

Read each page top to bottom as a team member at an event. For every sentence: is it important,
and does it read like a person wrote it? Fix or cut. Check phone width too, since long copy wraps
into walls of text there.
