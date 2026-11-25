# Prediction model backtest

## Result

Robot OPR won and ships as OPR. It keeps the priors of the earlier model (each team's earlier events and past seasons give a starting guess that the event's own matches soon override) and adds three things:

- Robot credit. Points recorded per robot (in 2026: leave, auto park, teleop park) go to that robot's team through its own rating. Only the rest of the non-penalty score is solved jointly across the alliance.
- Partner carry. An alliance with one much stronger team scores more than its two ratings add up to. The forecast adds 0.2 times the gap between the partners' shared-points ratings, and the fit leans 1.1 / 0.9 toward the stronger partner.
- No team below zero. Each team's total rating passes through a soft floor at zero, in the fit and in the forecast.

On held-out 2026 it beats the model it replaces by 0.00852 Brier (standard error 0.00067, 8,594 matches). On validation (2024 and 2025) the gap is 0.00345 (standard error 0.00019). It is better in every season, 2021 to 2026.

## How it was tested

- Data: every traditional FTC event on FTCScout for 2021 to 2026 (remote events skipped), 174,197 played matches after a 30 match warm-up per season. 2026 runs through 2026-11-23. Per-robot points for 2021 to 2025 come from FTCScout match details (`lab/robot/download.ts`, cached in `.cache/robot`); 2026 has them in the main download.
- Every match is predicted using only matches before it. Events run in date order, and season averages are frozen at the start of each day so same-day events cannot leak into each other.
- Matches with impossible scores are dropped: a total above 600, or auto plus teleop not adding up to the non-penalty score.
- Parameters were tuned on 2021 to 2025 (Brier for win chances, MAE for points), the model was picked on 2024 and 2025, and 2026 is held out. Robot OPR was tuned in `lab/` on 2021 to 2025 only (see `lab/FINAL.md`).
- Win chance comes from the predicted margin through a logistic curve whose scale was fit on 2021 to 2025.
- Brier and log loss count a tie as half a win. Accuracy leaves ties out. MAE is the error on one alliance's score without penalty points.

## Pooled numbers

| Model                                         | 2024-25 Brier | Log loss   | Accuracy  | MAE      | 2026 Brier | 2026 accuracy | 2026 MAE |
| --------------------------------------------- | ------------- | ---------- | --------- | -------- | ---------- | ------------- | -------- |
| OPR, this event only, season mean fallback    | 0.1941        | 0.5713     | 69.8%     | 30.6     | 0.1965     | 68.5%         | 17.7     |
| OPR, this event only, last event fallback     | 0.1939        | 0.5698     | 71.1%     | 27.1     | 0.2010     | 66.1%         | 17.1     |
| Ridge OPR toward the season mean              | 0.1850        | 0.5492     | 70.0%     | 28.4     | 0.1871     | 69.1%         | 15.7     |
| **Robot OPR (shipped)**                       | **0.1597**    | **0.4882** | **76.2%** | **23.4** | **0.1623** | **75.3%**     | **13.6** |
| OPR with priors (shipped until November 2026) | 0.1631        | 0.4971     | 75.5%     | 23.3     | 0.1708     | 73.8%         | 13.8     |
| EPA, no reset between events                  | 0.1648        | 0.5016     | 75.3%     | 24.3     | 0.1736     | 73.2%         | 14.3     |
| EPA, partial reset at each event              | 0.1645        | 0.5007     | 75.3%     | 24.4     | 0.1737     | 73.1%         | 14.4     |

The blend of the best plain OPR and EPA was tuned too. Its best training weight was 100% OPR, so it is the same model and is left out.

## Brier by season

| Season              | Matches | OPR event only | Ridge to mean | OPR with priors | Robot OPR | EPA    | EPA with reset |
| ------------------- | ------- | -------------- | ------------- | --------------- | --------- | ------ | -------------- |
| 2021 Freight Frenzy | 19,601  | 0.2109         | 0.2032        | 0.1832          | 0.1806    | 0.1847 | 0.1845         |
| 2022 POWERPLAY      | 28,186  | 0.2018         | 0.1934        | 0.1683          | 0.1651    | 0.1703 | 0.1699         |
| 2023 CENTERSTAGE    | 32,808  | 0.2013         | 0.1940        | 0.1702          | 0.1629    | 0.1719 | 0.1715         |
| 2024 INTO THE DEEP  | 39,799  | 0.1900         | 0.1807        | 0.1581          | 0.1542    | 0.1599 | 0.1596         |
| 2025 DECODE         | 45,209  | 0.1973         | 0.1887        | 0.1675          | 0.1645    | 0.1692 | 0.1688         |
| 2026 BIOBUZZ        | 8,594   | 0.1965         | 0.1871        | 0.1708          | 0.1623    | 0.1736 | 0.1737         |

"OPR event only" is the better of the two fallbacks per season.

## December 2026 update: robot OPR

Held-out 2026 (8,594 matches), the model shipped before this update against the one shipped now:

| Metric          | Before | After  |
| --------------- | ------ | ------ |
| Brier           | 0.1708 | 0.1623 |
| Log loss        | 0.5182 | 0.4969 |
| Winner accuracy | 73.8%  | 75.3%  |
| Score MAE       | 13.83  | 13.59  |

By 2026 slice (Brier, before and after): quals 0.1731 to 0.1641 (8,063 matches), playoffs 0.1371 to 0.1358 (531), matches where a team has fewer than two matches at the event 0.1919 to 0.1831, the rest 0.1589 to 0.1506.

- Production check: `parity.ts` runs the production `rateSeason` over every season and compares it with the backtest model match by match. Margin, score, variance and win chance agree exactly (max difference 0) on all 2021 to 2026 matches. `run.ts` repeats the check and records it as `productionCheck` in `accuracy.json`.
- Season priors blend the three seasons before: weights 1, 0.45 and 0.15 for one, two and three seasons back, for both the robot and the shared rating. `priors.ts` writes them to `previous-2025.json` (10,874 teams, rounded to 0.001, packed as columns). With the rounded file, 2026 margins move by at most 0.013 points.
- The OPR shown on the site is a team's own score rating: robot plus shared rating, through the zero floor. Point parts (auto, hive and the rest) are scaled to add up to it. The carry bonus belongs to the alliance, so shown OPRs add up to a little less than an alliance forecast.
- Win mapping refit on 2021 to 2025: logistic, scale 0.354, no extra widening for matches played, scoring level to the power 0.5. The tie rate (now 2.5%) and the RP calibration were refit on 2026 with the new forecasts. The score spread refit to 0.488, which rounds to the 0.49 already shipped.
- Cached analysis switches over through `MODEL_VERSION` in the cache keys (event analysis, season ratings, event ratings, event strength).

Tried in `lab/` and dropped: blending a pooled OPR on top (best on train, worse on 2026), a carry term on the robot rating, and carry measured on total or floored ratings.

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

Rating (`src/lib/model/opr.ts`, `OPR_PARAMS`): two Kalman ratings per team. The shared rating is fitted jointly over the alliance on the non-penalty score minus both robots' own points: prior weight 2.5 (new) or 2 (returning) matches, starting strength 0.2 or 0.4 of an average team plus 0.5 times the blended past relative rating, variance growth 0.15 per event plus 0.015 per week, and match noise that grows with the predicted score (to the power 0.45). The robot rating is per team, fed by the points that robot scored itself: prior weight 0.432 or 1.2, growth 0.375 per event plus 0.025 per week, carry 1.1 between events. Ratings scale with the season scoring average to the power 0.25. Soft floor at zero, width 0.25 of an average team. Partner carry 0.2 in the forecast, 1.1 / 0.9 in the fit. Parts (auto, tips and the rest) keep their own ratings with an event-wide shift, as before.

Win chance (`src/lib/model/predict.ts`): logistic, scale 0.354 times the season's alliance score SD, widened by the model's own uncertainty (shared plus robot rating variance) and by the alliances' expected scoring level to the power 0.5. Tie chance peaks at 2.5% for an even match.

Calibration on 2026 (predicted win chance against how often red won):

| Predicted | 0.05 | 0.15 | 0.25 | 0.35 | 0.45 | 0.55 | 0.65 | 0.75 | 0.85 | 0.95 |
| --------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Observed  | 0.04 | 0.09 | 0.22 | 0.39 | 0.43 | 0.55 | 0.67 | 0.78 | 0.88 | 0.96 |

## BIOBUZZ ranking points (2026 quals, 16,182 alliances)

- Swarm (leave plus park at least 16): each robot's leave and park outcome is tracked per team, with last event's record kept at 10% weight, then combined with the predicted leave and park points in one logistic fit. Brier 0.179, 22% better than always guessing the base rate of 64%. The robot record alone scored 0.191.
- Pollinator 1 and 2 (at least 4 and 7 tips): tips OPR into a Poisson count. Poisson beat negative binomial at every size tried. After recalibration: Brier 0.039 and 0.0074, base rates 8.2% and 1.1%.
- Holdout check, fitting on events before 2026-11-08 and scoring the later ones (9,344 alliances): Swarm 0.184 raw, 0.173 calibrated; Pollinator 1 0.048 raw, 0.046 calibrated; Pollinator 2 0.0099 both.

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

- 2026 has 8,594 matches so far, so its numbers move by about 0.004 Brier from noise. Paired comparisons on the same matches are much tighter.
- 2024 and 2025 were used both to tune and to pick the model, so their numbers are in-sample. 2026 is the honest check.
- RP calibration, the tie rate and the score spread were fit on 2026 itself, the only BIOBUZZ data. The ratings and the win mapping were not.

## Reproduce

```
node scripts/backtest/download.ts        # fetches into .cache/hist, reuses the cache
node scripts/backtest/lab/robot/download.ts                # per-robot points, 2021 to 2025
node --max-old-space-size=4000 scripts/backtest/run.ts     # bake-off and accuracy.json, --tune to retune
node --max-old-space-size=4000 scripts/backtest/rp.ts      # ranking point calibration
node scripts/backtest/schedule.ts                          # start time estimates
node scripts/backtest/priors.ts                            # blended past-season ratings for 2026
node --max-old-space-size=2500 scripts/backtest/parity.ts  # production against the backtest model
node scripts/backtest/contexts.ts                          # analysis contexts for tests/analysis
```
