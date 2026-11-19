# Prediction model backtest

## Result

OPR with priors from earlier events won. It is an ordinary least squares OPR on non-penalty scores, solved at every event, with each team's earlier events (and last season) used as a starting guess that the event's own matches quickly override. It beat every EPA variant in every season, on validation and on 2026. The site ships it and calls it OPR.

Validation Brier gap against the best EPA variant: 0.00126 (standard error 0.00011, 85,029 matches).

## How it was tested

- Data: every traditional FTC event on FTCScout for 2021 to 2026 (remote events skipped), 172,088 played matches after a 30 match warm-up per season. 2026 runs through 2026-11-18.
- Every match is predicted using only matches before it. Events run in date order, and season averages are frozen at the start of each day so same-day events cannot leak into each other.
- Parameters were tuned on 2021 to 2023 (Brier), the model was picked on 2024 to 2025, and 2026 is reported as a check.
- Win chance comes from the predicted margin through a logistic curve whose scale was fit on 2021 to 2023 only.
- Brier and log loss count a tie as half a win. Accuracy leaves ties out. MAE is the error on one alliance's score without penalty points.

## Pooled numbers

| Model                                      | Validation Brier | Log loss   | Accuracy  | MAE      | 2026 Brier | 2026 accuracy | 2026 MAE |
| ------------------------------------------ | ---------------- | ---------- | --------- | -------- | ---------- | ------------- | -------- |
| OPR, this event only, season mean fallback | 0.1947           | 0.5726     | 69.8%     | 30.6     | 0.1988     | 68.2%         | 17.6     |
| OPR, this event only, last event fallback  | 0.1942           | 0.5706     | 71.1%     | 27.2     | 0.2037     | 65.4%         | 17.2     |
| Ridge OPR toward the season mean           | 0.1853           | 0.5503     | 70.0%     | 28.4     | 0.1890     | 68.8%         | 15.5     |
| **OPR with priors (shipped)**              | **0.1636**       | **0.4986** | **75.5%** | **24.3** | **0.1738** | **73.3%**     | **14.3** |
| EPA, no reset between events               | 0.1654           | 0.5032     | 75.2%     | 24.6     | 0.1759     | 72.7%         | 14.3     |
| EPA, partial reset at each event           | 0.1649           | 0.5017     | 75.3%     | 24.3     | 0.1758     | 72.8%         | 14.3     |

The blend of the best OPR and EPA was tuned too. Its best training weight was 100% OPR, so it is the same model.

## Brier by season

| Season              | Matches | OPR event only | Ridge to mean | OPR with priors | EPA    | EPA with reset |
| ------------------- | ------- | -------------- | ------------- | --------------- | ------ | -------------- |
| 2021 Freight Frenzy | 19,601  | 0.2104         | 0.2027        | 0.1829          | 0.1843 | 0.1839         |
| 2022 POWERPLAY      | 28,186  | 0.2019         | 0.1934        | 0.1681          | 0.1699 | 0.1698         |
| 2023 CENTERSTAGE    | 32,809  | 0.2012         | 0.1939        | 0.1704          | 0.1719 | 0.1715         |
| 2024 INTO THE DEEP  | 39,799  | 0.1906         | 0.1813        | 0.1587          | 0.1605 | 0.1601         |
| 2025 DECODE         | 45,230  | 0.1974         | 0.1889        | 0.1680          | 0.1697 | 0.1691         |
| 2026 BIOBUZZ        | 6,463   | 0.1988         | 0.1890        | 0.1738          | 0.1759 | 0.1758         |

"OPR event only" is the better of the two fallbacks per season. OPR with priors also wins in quals, in playoffs, in each team's first two matches of an event and later, and at official and unofficial events, in every season. The two exceptions are within 0.0006 (2021 playoffs, 2023 unofficial events).

## What mattered

- Priors. Plain event OPR is unusable for the first few matches of an event. A prior from the team's earlier events fixes most of that.
- Last season. Starting each team at 0.6 times how far above or below average it finished last season was worth about 0.0017 Brier on 2021 to 2023 during tuning.
- Rebuilds. Older information is trusted less: the prior's variance grows by a fixed amount per event and a little more per week since the team last played. EPA also did better with a partial reset of its learning rate at each new event.
- New teams. For win chances, teams with no history are best treated as much weaker than the season average. That makes score predictions too low, so expected points use a second, unbiased prior on the same OPR system. Win chances and points come from the same matches and the same uncertainty.

## Shipped parameters

Rating (`src/lib/model/opr.ts`): prior weight 2.4 matches for teams new to the season and 2.0 for teams with a rating from last season; starting strength 0.2 (new) or 0.4 (returning) of an average team, plus 0.6 times last season's relative rating above average; expected points use 0.8 and 0.9 instead; prior variance grows by 0.1 per event plus 0.02 per week away, both in units of one alliance score's noise; no extra shrinking between events; prior scaled by the change in the season scoring average to the power 0.25.

Win chance (`src/lib/model/predict.ts`): logistic, scale 0.424 times the season's alliance score SD, widened by the model's own uncertainty, by 0.2 times the sum of 1 / (1 + matches played at the event) over the four teams, and by the alliances' expected scoring level to the power 0.375. Tie chance peaks at 2.5% for an even match.

Calibration on 2026 (predicted win chance against how often red won):

| Predicted | 0.05 | 0.15 | 0.25 | 0.35 | 0.45 | 0.55 | 0.65 | 0.75 | 0.85 | 0.95 |
| --------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Observed  | 0.05 | 0.13 | 0.24 | 0.34 | 0.46 | 0.57 | 0.65 | 0.77 | 0.86 | 0.95 |

## BIOBUZZ ranking points (2026 quals, 12,286 alliances)

- Swarm (leave plus park at least 16): each robot's leave and park outcome is tracked per team, with last event's record kept at 10% weight. This beat a normal model on the alliance's predicted leave and park points (Brier 0.195 against 0.219). After a recalibration fit on 2026: Brier 0.192, 18% better than always guessing the base rate of 63%.
- Pollinator 1 and 2 (at least 4 and 7 tips): tips OPR into a Poisson count. Poisson beat negative binomial at every size tried. After recalibration: Brier 0.036 and 0.0069, base rates 7.4% and 1.0%.
- The recalibration was also checked by fitting on events before 2026-11-08 and scoring the later ones: it lowered Brier there for all three (Swarm 0.188 to 0.185, Pollinator 1 0.048 to 0.043, Pollinator 2 0.0108 to 0.0106).

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

- 2026 has 6,463 matches so far, so its numbers move by about 0.005 Brier from noise.
- The drift exponent ended at the edge of its search range (0.25); a lower value might be slightly better.
- RP recalibration and the RP model settings were fit on 2026 itself, the only BIOBUZZ data.

## Reproduce

```
node scripts/backtest/download.ts        # fetches into .cache/hist, reuses the cache
node scripts/backtest/run.ts             # bake-off, add --tune to retune (about 30 minutes)
node scripts/backtest/rp.ts              # ranking point calibration
node scripts/backtest/schedule.ts        # start time estimates
node scripts/backtest/priors.ts          # last season ratings for 2026
```
