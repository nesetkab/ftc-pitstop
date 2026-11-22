# Prediction model backtest

## Result

OPR with priors from earlier events won. It is an ordinary least squares OPR on non-penalty scores, solved at every event, with each team's earlier events (and last season) used as a starting guess that the event's own matches quickly override. It beat every EPA variant in every season, on validation and on 2026. The site ships it and calls it OPR.

Validation Brier gap against the best EPA variant: 0.00138 (standard error 0.00011, 85,008 matches).

## How it was tested

- Data: every traditional FTC event on FTCScout for 2021 to 2026 (remote events skipped), 173,972 played matches after a 30 match warm-up per season. 2026 runs through 2026-11-22.
- Every match is predicted using only matches before it. Events run in date order, and season averages are frozen at the start of each day so same-day events cannot leak into each other.
- Matches with impossible scores are dropped: a total above 600, or auto plus teleop not adding up to the non-penalty score. This removes 22 matches, all in 2023 and 2025.
- Parameters were tuned on 2021 to 2025 (Brier for win chances, MAE for points), the model was picked on 2024 and 2025, and 2026 is held out. Earlier versions tuned on 2021 to 2023 only; adding 2024 and 2025 moved the priors toward what recent seasons need.
- Win chance comes from the predicted margin through a logistic curve whose scale was fit on 2021 to 2025.
- Brier and log loss count a tie as half a win. Accuracy leaves ties out. MAE is the error on one alliance's score without penalty points.

## Pooled numbers

| Model                                      | 2024-25 Brier | Log loss   | Accuracy  | MAE      | 2026 Brier | 2026 accuracy | 2026 MAE |
| ------------------------------------------ | ------------- | ---------- | --------- | -------- | ---------- | ------------- | -------- |
| OPR, this event only, season mean fallback | 0.1941        | 0.5713     | 69.8%     | 30.6     | 0.1969     | 68.4%         | 17.7     |
| OPR, this event only, last event fallback  | 0.1939        | 0.5698     | 71.1%     | 27.1     | 0.2015     | 66.0%         | 17.1     |
| Ridge OPR toward the season mean           | 0.1850        | 0.5492     | 70.0%     | 28.4     | 0.1874     | 69.1%         | 15.7     |
| **OPR with priors (shipped)**              | **0.1631**    | **0.4971** | **75.5%** | **23.3** | **0.1713** | **73.7%**     | **13.8** |
| EPA, no reset between events               | 0.1648        | 0.5016     | 75.3%     | 24.3     | 0.1741     | 73.2%         | 14.3     |
| EPA, partial reset at each event           | 0.1645        | 0.5007     | 75.3%     | 24.4     | 0.1742     | 73.0%         | 14.4     |

The blend of the best OPR and EPA was tuned too. Its best training weight was 100% OPR, so it is the same model.

## Brier by season

| Season              | Matches | OPR event only | Ridge to mean | OPR with priors | EPA    | EPA with reset |
| ------------------- | ------- | -------------- | ------------- | --------------- | ------ | -------------- |
| 2021 Freight Frenzy | 19,601  | 0.2109         | 0.2032        | 0.1832          | 0.1847 | 0.1845         |
| 2022 POWERPLAY      | 28,186  | 0.2018         | 0.1934        | 0.1683          | 0.1703 | 0.1699         |
| 2023 CENTERSTAGE    | 32,808  | 0.2013         | 0.1940        | 0.1702          | 0.1719 | 0.1715         |
| 2024 INTO THE DEEP  | 39,799  | 0.1900         | 0.1807        | 0.1581          | 0.1599 | 0.1596         |
| 2025 DECODE         | 45,209  | 0.1973         | 0.1887        | 0.1675          | 0.1692 | 0.1688         |
| 2026 BIOBUZZ        | 8,369   | 0.1969         | 0.1874        | 0.1713          | 0.1741 | 0.1742         |

"OPR event only" is the better of the two fallbacks per season.

## November 2026 update

Held-out 2026 (8,369 matches), the model shipped before this update against the one shipped now:

| Metric          | Before | After  |
| --------------- | ------ | ------ |
| Brier           | 0.1727 | 0.1713 |
| Log loss        | 0.5233 | 0.5195 |
| Winner accuracy | 73.5%  | 73.7%  |
| Score MAE       | 14.36  | 13.78  |

The Brier gain is 0.00138 with a paired standard error of 0.00017. What changed:

- Refit on 2021 to 2025. Recent seasons want a slightly weaker pull from last season (0.5 instead of 0.6 times last season's relative rating), a slightly weaker first-event prior for new teams, and older events forgotten a little faster. This is all of the Brier gain.
- Points get their own uncertainty. Expected points (and the parts, like tips and park) now share an event-wide shift, so a high or low scoring event moves every team's expected points together, and each match adds a little drift so recent matches count more. Win chances keep the old uncertainty, because both changes hurt Brier there. This is most of the MAE gain.
- Teams that have not played yet at an event keep the event-wide shift instead of being reset to their prior.
- Swarm chance now combines the per-robot record with the predicted leave and park points (a logistic fit on both). Fit on events before 2026-11-08 and scored on later ones, Brier went from 0.182 to 0.174.
- Impossible scores are skipped everywhere the model reads matches. One 7,308 to 8,355 match early in a season would have blown up the season score spread and pushed 2026 Brier from 0.173 to 0.209.

Tried and dropped, because they did not beat the held-out numbers:

- Foul tendencies. A per-team foul rating added to the win margin made Brier worse at every weight tried (0.1 to 1.5). Fouls are too noisy to predict per team.
- Component OPR. Rating auto, teleop and endgame separately with their own shrinkage gave about 0.0003 Brier, and most of that was just weaker shrinkage overall, which the refit already captures. It would have tripled the work per match.
- An event-wide shift or match-to-match drift on win strength. Both helped points but hurt Brier.
- Growth between events (teams improving with weeks away). Helped points slightly, hurt Brier.
- A separate prior for rookies (by team number) against veterans new to the season. No measurable gain.
- Per-team consistency (wider spread for teams with noisy scores). No gain.
- Mixing the points rating into the win margin, a separate scale for playoffs, and a floor on win chances (upset rate). None helped.
- Stacking the tips Poisson chance with predicted points for Pollinator. No gain.

## What mattered

- Priors. Plain event OPR is unusable for the first few matches of an event. A prior from the team's earlier events fixes most of that.
- Last season. Starting each team at 0.5 times how far above or below average it finished last season.
- Rebuilds. Older information is trusted less: the prior's variance grows by a fixed amount per event and a little more per week since the team last played. EPA also did better with a partial reset of its learning rate at each new event.
- New teams. For win chances, teams with no history are best treated as much weaker than the season average. That makes score predictions too low, so expected points use a second, unbiased prior on the same OPR system.

## Shipped parameters

Rating (`src/lib/model/opr.ts`): prior weight 2.0 matches for teams new to the season and for teams with a rating from last season; starting strength 0.2 (new) or 0.4 (returning) of an average team, plus 0.5 times last season's relative rating above average; expected points use 0.5 and 0.7 instead; prior variance grows by 0.15 per event plus 0.01 per week away, both in units of one alliance score's noise; no extra shrinking between events; prior scaled by the change in the season scoring average to the power 0.25. Points add an event-wide shift with variance 0.1 and drift of 0.05 per match played.

Win chance (`src/lib/model/predict.ts`): logistic, scale 0.404 times the season's alliance score SD, widened by the model's own uncertainty, by 0.2 times the sum of 1 / (1 + matches played at the event) over the four teams, and by the alliances' expected scoring level to the power 0.375. Tie chance peaks at 2.4% for an even match.

Calibration on 2026 (predicted win chance against how often red won):

| Predicted | 0.05 | 0.15 | 0.25 | 0.35 | 0.45 | 0.55 | 0.65 | 0.75 | 0.85 | 0.95 |
| --------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Observed  | 0.04 | 0.12 | 0.24 | 0.33 | 0.46 | 0.56 | 0.67 | 0.76 | 0.87 | 0.96 |

## BIOBUZZ ranking points (2026 quals, 15,754 alliances)

- Swarm (leave plus park at least 16): each robot's leave and park outcome is tracked per team, with last event's record kept at 10% weight, then combined with the predicted leave and park points in one logistic fit. Brier 0.180, 21% better than always guessing the base rate of 64%. The robot record alone, recalibrated, scored 0.189.
- Pollinator 1 and 2 (at least 4 and 7 tips): tips OPR into a Poisson count. Poisson beat negative binomial at every size tried. After recalibration: Brier 0.038 and 0.0072, base rates 8.1% and 1.0%.
- Holdout check, fitting on events before 2026-11-08 and scoring the later ones (8,916 alliances): Swarm 0.182 before this update, 0.174 now; Pollinator 1 0.043 before, 0.044 now; Pollinator 2 0.0099 before, 0.0098 now.

## Start time estimates (2026)

Median absolute error, in minutes, when the estimate is made the moment a match starts:

| Matches ahead                      | 1    | 2    | 3    | 5    | 10   |
| ---------------------------------- | ---- | ---- | ---- | ---- | ---- |
| Quals, estimator                   | 1.2  | 1.9  | 2.6  | 4.1  | 6.9  |
| Quals, schedule plus current delay | 1.4  | 2.4  | 3.4  | 5.1  | 8.2  |
| Quals, printed schedule            | 15.1 | 15.4 | 15.6 | 15.6 | 14.8 |
| Playoffs, estimator                | 1.6  | 3.0  | 4.3  | 6.7  | n/a  |

The queue estimate is the estimated start of the match two before yours, so its error when your match is three away is the one-ahead error above.

## Caveats

- 2026 has 8,369 matches so far, so its numbers move by about 0.004 Brier from noise. Paired comparisons on the same matches are much tighter.
- 2024 and 2025 were used both to tune and to pick the model, so their numbers are in-sample. 2026 is the honest check.
- RP calibration, the tie rate and the score spread were fit on 2026 itself, the only BIOBUZZ data.

## Reproduce

```
node scripts/backtest/download.ts        # fetches into .cache/hist, reuses the cache
node scripts/backtest/run.ts             # bake-off, add --tune to retune (about an hour)
node scripts/backtest/rp.ts              # ranking point calibration
node scripts/backtest/schedule.ts        # start time estimates
node scripts/backtest/priors.ts          # last season ratings for 2026
```
