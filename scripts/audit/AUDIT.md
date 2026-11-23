# Data audit, November 2026

PitStop's numbers checked against the FIRST FTC Events API and FTCScout for nine finished events
on 2026-11-23. Rerun with the dev server up:

```sh
node --env-file=.env.local scripts/audit/audit.ts USMTBUQ KZASQ1 AUPYQ USMINOQ USMISOQ USFLORM1 CNSHQ1 USAZGIQ UZTAQ1
```

Raw responses are cached in `.cache/audit/` (add `--fresh` to refetch). `--snapshot` writes the
compact FTCScout snapshots behind `tests/data/audit.test.ts`, which replays the same checks offline
against stored fixtures for AUPYQ, USMTBUQ, UZTAQ1 and USFLORM1.

## Results

Counts are rows compared. A star means a difference was found; every one is explained below.
No championship had finished yet, so none is included.

| Event    | Kind                       | Teams | Played | Rankings | Matches | Awards | Alliances | Advancement | Insights |
| -------- | -------------------------- | ----: | -----: | -------: | ------: | -----: | --------: | ----------: | -------: |
| USMTBUQ  | Qualifier, 3 DQ, surrogate |    31 |     49 |      31* |      49 |     21 |         6 |          13 |        6 |
| KZASQ1   | Qualifier, 4 DQ            |    34 |     62 |      34* |      62 |     20 |         6 |           0 |        6 |
| AUPYQ    | Qualifier                  |    30 |     55 |       30 |      55 |     22 |         6 |           9 |        6 |
| USMINOQ  | Michigan, tied final       |    36 |     57 |       36 |      57 |    23* |         6 |           8 |        6 |
| USMISOQ  | Michigan, 3 surrogates     |    29 |     48 |       29 |      48 |     22 |         6 |           6 |        6 |
| USFLORM1 | League meet                |    35 |     44 |      35* |      44 |      0 |         0 |           0 |        6 |
| CNSHQ1   | China                      |    24 |     46 |       24 |      46 |     21 |         6 |           6 |        6 |
| USAZGIQ  | Qualifier, surrogate       |    27 |     44 |       27 |      44 |     16 |         6 |           5 |        6 |
| UZTAQ1   | Qualifier, 8 DQ/no-shows   |    11 |     23 |      11* |      23 |     13 |         4 |           0 |        6 |

- **Rankings** (rank, RS, TBP, W-L-T, played) match FIRST exactly at all nine events.
- **Match scores** match FTCScout on every played match: total, NP, auto, teleop, foul points,
  leave, auto park, auto hive, teleop hive, flower, garden, teleop park, major and minor fouls.
- **Awards** match FTCScout team for team. **Alliances** match FIRST, every playoff alliance on
  the field was one selected alliance, and the last playoff winner always held the Winning
  Alliance award. **Advancement** lists match FIRST slot for slot.
- **Insights averages** (total, auto, teleop, hive, flower, garden) match averages taken straight
  from FTCScout scores.
- **Season records**: the top 10 scores on /records were each looked up in FIRST's score details.
  All 10 match.
- **Strength**: the top-8 average recomputed from /api/ratings matches /events/strength for every
  listed event.
- **Advancement counts**: Montana shows 12 advanced from USMTBUQ's 13 slots because slot 3 is
  marked ineligible by FIRST. Correct.

## Differences and causes

**FTCScout recalculates rankings and ignores disqualifications.** At USMTBUQ, KZASQ1 and UZTAQ1,
FTCScout still gives RP and TBP for matches a team was disqualified from or missed. FIRST counts
those as zero. UZTAQ1 team 35580 was disqualified from all six matches: FIRST ranks it 11th with
RS 0, FTCScout ranks it 6th. PitStop shows FIRST's numbers. Not a PitStop bug, but it leaked into
the team page (see fixes).

**League meet rankings are league rankings.** At league meets FIRST ranks over each team's best
10 league matches and divides RS and TBP by 10 even when fewer were played. USFLORM1 was the first
meet, so every team's RS is half its per-match average. FTCScout divides by matches played. PitStop
shows FIRST's numbers; the label said "average per match", which was wrong there.

**Volunteer Award.** FIRST lists a Volunteer Award at USMINOQ that FTCScout does not track.

**OPR.** FTCScout's event OPR is exactly classic least squares over qualification NP scores (zero
difference at all nine events). PitStop's event OPR starts each team from a prior and also counts
playoffs. Both leave penalties out, so there is no systematic gap:

| Event    | Mean diff | Mean abs diff | Max abs diff | Correlation | Rank agreement |
| -------- | --------: | ------------: | -----------: | ----------: | -------------: |
| USMTBUQ  |     +0.64 |          4.31 |        13.68 |        0.89 |           0.86 |
| KZASQ1   |     +0.30 |          6.16 |        30.82 |        0.95 |           0.97 |
| AUPYQ    |     +0.88 |          4.52 |        13.53 |        0.97 |           0.95 |
| USMINOQ  |     -0.14 |          4.40 |        19.12 |        0.97 |           0.95 |
| USMISOQ  |     -1.34 |          3.95 |        20.93 |        0.97 |           0.92 |
| USFLORM1 |     +0.31 |          2.46 |        11.77 |        0.99 |           0.97 |
| CNSHQ1   |     -2.93 |          7.04 |        21.62 |        0.96 |           0.96 |
| USAZGIQ  |     -0.72 |          3.29 |        12.31 |        0.96 |           0.98 |
| UZTAQ1   |     +2.55 |          5.88 |        13.72 |        0.95 |           0.69 |

Adding playoffs alone moves classic OPR by up to 5.4 points per team on average (none at the league meet, which has no playoffs); the rest is the prior.
Explained on /about#opr.

## Fixes

- **Team page event rank now uses FIRST's rankings.** It used FTCScout's rank, so at events with
  disqualifications it could disagree with the event page (USMTBUQ team 22520 showed 24th, FIRST
  says 25th). League meets keep the meet rank, since FIRST's league ranking covers other meets.
- **World and region rank agree everywhere.** The team page counted teams with a higher rounded
  OPR, the leaderboard listed ties by team number, and the season build ordered by unrounded OPR.
  About 1,380 teams were shown a world rank up to 5 places off their leaderboard row. All three now
  rank by the displayed OPR with ties broken by team number.
- **Labels.** The team page "Record" is now "Qual record" (qualification matches at every event,
  playoffs not counted). Rankings notes and /about explain that DQ and no-show matches count as zero
  in RS and TBP, and how league rankings divide by 10.
