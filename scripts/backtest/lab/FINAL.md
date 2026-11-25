# Final match model

**Pick: robot-imb plus a soft floor at zero, used in both the fit and the prediction.** Code: `lab/final/model.ts` (spec `final`), model class `FinalOpr` in `lab/final/heads.ts`. Run it with `node --max-old-space-size=2500 scripts/backtest/lab/final/eval.ts --blend --loso final`.

The idea in plain words: robot-imb already says a lopsided alliance scores more than its two ratings add up to (the strong robot carries). The floor adds that no team is worth less than nothing. A rating that drifts negative gets pulled back toward zero, smoothly, and the fit knows about it too so it stops pushing weak teams further down.

## Parameters

Everything from robot-imb stays: `lab/robot/params/het.json` (rest and robot components, `rVar` 1, `hist` [0.45, 0.15], `het` 0.45), `imbPred` 0.2, `imbFit` 0.1.

New:

- **Floor**: `floor` 0, `width` 0.25, on each team's total rating relative to half the season mean, r = (rest + robot) / (mean / 2). f(r) = 0.25 · ln(1 + e^(r / 0.25)).
- **In prediction**: alliance strength = (mean / 2) · Σ f(r) + 0.2 · |rest_hi − rest_lo|. The same floor applies to the score forecast (scores use the `nu` ratings).
- **In the fit**: the rest update is linearised around the floor. Each team's measurement weight is multiplied by σ(r / 0.25), and the target becomes y − Σ[(mean/2)·f(r) − tot] − Σ(1 − σ)·rest.
- **Win mapping** (fit on 2021-2025, FULL_FIT): logit, kappa 0.35378, eta 0, gamma 0.5.

Tuned on 2021-2025 only. The floor and width were swept for prediction only (best: floor 0.1, width 0.16), for the fit only, and with one shared value. A single shared floor of 0, width 0.25, was the best on train and the simplest. Re-tuning imbPred and imbFit with the floor moved train by 0.00003 or less, so they stay at 0.2 and 0.1.

## Results (2026 held out, all matches incl. playoffs)

| model | train | 2026 | acc | quals | playoffs | MAE | vs oddbot matches |
|---|---|---|---|---|---|---|---|
| shipped opr-map | 0.16778 | 0.17084 | 73.8% | 0.1731 | 0.1371 | 13.83 | 0.1708 |
| RobotOpr (het) | 0.16479 | 0.1659 | | | | | |
| robot-imb | 0.16400 | 0.16343 | 75.1% | 0.1652 | 0.1361 | 13.71 | 0.1634 |
| **final** | **0.16370** | **0.16233** | **75.3%** | **0.1641** | **0.1358** | **13.59** | **0.1622** |
| oddbot | | | | | | | 0.1645 (quals 0.1662, playoffs 0.1388) |

- **Final vs robot-imb on 2026**: −0.00110 ± 0.00018 (about −6 se). Vs shipped: −0.00852 ± 0.00067.
- **Leave-one-season-out** (mapping refit on the other four train seasons): final beats robot-imb in all five seasons, 2021-2025.
- **Vs oddbot** on the 8,534 matches they predicted: 0.1622 vs 0.1645 overall, 0.1640 vs 0.1662 in quals, 0.1358 vs 0.1388 in playoffs.

What did not make it:

- **Pooled-OPR blend on top** (0.35 pooled-imb): best train (0.16341) but worse on 2026 than final without it (+0.00037 ± 0.00023). It also means running a second model, so it stays out.
- **Imbalance on the robot component** (extra |robot_hi − robot_lo| term, ±0.1): no train gain.
- **Imbalance gap on total or floored ratings** instead of the rest rating: slightly worse on train.

Results are in `lab/final/results/` (`final.json` is the table above, plus the sweeps).

## Porting to production

This replaces the shipped single-rating OPR with the RobotOpr structure, so it is more than a tweak to `opr.ts`.

`src/lib/model/opr.ts`:

1. Split each team's rating in two. **Robot**: a per-team Kalman rating (independent per team) fed by the robot-attributable points that team scored itself each match. **Rest**: the alliance's non-penalty points minus both robots' own points, fitted jointly over the alliance as the current rater does. Use the two parameter blocks in `het.json`.
2. Rest update noise scales with the predicted rest score: r = clamp(pred / restMean, 0.25, 4)^0.45.
3. In the rest update, weight the stronger team (by rest score rating) by 1.1 and the weaker by 0.9 (imbFit).
4. Add the floor to the rest update as described above (weights times σ(r / 0.25), adjusted target).
5. Season carry-over: previous-season relative rating = 1 · this season + 0.45 · last + 0.15 · the one before, normalised (`hist`).
6. Margin variance adds the robot ratings' variance (`rVar` 1).

`src/lib/model/predict.ts`: alliance strength and score become (mean / 2) · Σ f(r) + 0.2 · |rest_hi − rest_lo|. Then swap `WIN_PARAMS` to logit, kappa 0.35378, eta 0, gamma 0.5 (tie unchanged until refit).

**Per-robot score fields the live data must carry**, by season (robot index from the station, see `lab/robot/data.ts`). Each robot's points are its auto points plus its endgame points:

- 2021: `autoNav2021_1/2`, `autoBonus1/2` with `barcodeElement1/2`, `egPark1/2`
- 2022: `autoNav2022_1/2`, `egNav1/2`
- 2023: `autoNav1/2`, `purple1/2`, `yellow1/2`, `egNav2023_1/2`, `drone1/2`
- 2024: `autoPark1/2`, `dcPark1/2`
- 2025: `autoLeave1/2`, `dcBase1/2`
- 2026: `autoLeave1/2` with alliance `autoLeavePoints`, `autoParkPoints1/2`, `dcParkPoints1/2`

Every season also needs alliance `autoPoints` and each team's station. When a match has no per-robot detail, the robot rating is just subtracted from the target (already handled in `observeSide`). Each new game needs a new per-robot points mapping.
