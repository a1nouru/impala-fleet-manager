# Driver Records tab — plan (2026-11-08)

New HR tab **Driver Records** (`/dashboard/hr/drivers`) next to Vehicle Damages / Employees / Payroll.
Goal: a points-based scorecard per driver to decide who has earned a pay increase.
Ships to BOTH `royalexpress-fleet-manager` and `impala-fleet-manager` (mirrored code).

## What the data supports today (checked live, read-only, 2026-11-08)

| Source | Royal Express | Impala | Driver link |
|---|---|---|---|
| `maintenance_records` | 1,076 rows; `driver_id` on **100% since Jun 2026** (372 rows, 22 drivers) | 659 rows, 322 with driver | `driver_id → employees.id` ✅ |
| `parts[]` on maintenance | free text, e.g. `PNEU GORDEN CROWN (Qty: 1)`, `Tire - 295/80R22.5 (Qty: 2)` | same | via record |
| `vehicle_damages` | 3 rows | — | `employee_id` ✅ |
| `daily_reports` (revenue) | 5,141 rows | 3,813 rows | ❌ **no driver column** |
| `employees.vehicle_id` | only 2 set | 0 set | ❌ can't use: buses rotate 2–11 drivers each |

**The gap:** revenue can't be attributed to drivers yet. Each bus has several drivers, so "revenue of the driver's bus" would be wrong.

## Step 1 — Record the driver on each daily report (small, required)

- Migration (both DBs): `ALTER TABLE daily_reports ADD COLUMN driver_id uuid REFERENCES employees(id) ON DELETE SET NULL;`
- Add a **Driver** select to the daily report create/edit dialog (`app/dashboard/financials/page.tsx` → `financialService.createDailyReport`, plus the edit dialog in `financials/reports/page.tsx`). Reuse the driver picker from the maintenance form.
- **Past reports (recommended default):** estimate the driver for a vehicle+date from the closest maintenance record on that vehicle within ±7 days. Mark those numbers as *est.* in the UI. Don't write the estimates into the DB. Once enough real `driver_id` data has built up, turn the estimate off.

## Step 2 — Scoring logic (pure TS, one file + one test)

`lib/driver-score.ts`: takes maintenance records, daily reports, damages and employees for a date range, and returns one scorecard per driver. It runs client-side, like the existing pages, so the only DB change is Step 1.

**Classifying parts** (case-insensitive keywords; `(Qty: N)` gives the quantity):
- **Tire:** `pneu|tire|tyre`
- **Routine, not counted against the driver:** `óleo|oleo|oil|filtro|filter|sinopec|15w40|silicone|cilcone`. An oil change isn't the driver's fault.
- **Wear/spare part (counts):** everything else, e.g. brake pads/calço, clutch/embraiagem, lights, cinta

**Exposure:** days driven = operational daily reports for that driver (actual or estimated). All counts are normalized **per 30 days driven**, so a driver with more shifts isn't penalized.

**Points (out of 100).** Each component is a percentile rank against the rest of the fleet for the same period:

| Component | Weight | Better = |
|---|---|---|
| Revenue per day driven | 40 | higher |
| Tire changes / 30 days | 20 | lower |
| Wear spare parts / 30 days | 15 | lower |
| Maintenance cost (AOA) / 30 days | 15 | lower |
| Damages (count + unpaid balance) | 10 | lower; any damage in the period caps this component at 50% |

**Tiers:** **≥ 80 Raise-eligible** · 60–79 Good · < 60 Watch. A driver with fewer than 20 days driven in the period shows **"Not enough data"** and isn't ranked. Put the weights and thresholds in one `const` at the top of the file so management can tune them.

Test: `lib/driver-score.test.ts` with about 3 fake drivers. It asserts part classification, Qty parsing, per-30-day normalization, tier assignment and the not-enough-data cutoff.

## Step 3 — UI (bklit charts)

Copy the bklit chart components we already use from `guinea-industrial-parks/app/src/components/charts` (bar, radar, gauge, line/area, composed). Don't reinstall them. Known gotchas: add `className="w-full"`, fix `var(----chart-*)`, and swap the paid stat-card icons for lucide icons.

Page layout, using the same date filter as Vehicle Damages (default: last 3 months):
1. **KPI cards:** drivers ranked · raise-eligible count · fleet tire changes · fleet wear-part cost
2. **Leaderboard:** horizontal bar chart of total score, each bar split into its 5 components, colored by tier
3. **Revenue vs maintenance cost per driver** (composed chart). Shows who earns the most while costing the least.
4. **Ranked table:** rank, driver, tier badge, score, days driven, revenue/day, tires, spare parts, maintenance AOA, damages. Sortable and exportable to CSV (reuse the CSV pattern from the maintenance page).
5. **Driver drill-down** (click a row): gauge (score) + radar (5 components against the fleet median) + monthly line (score and tire count) + list of that driver's maintenance events and parts

Add the i18n keys to `public/locales/{en,pt}/hr.json`. Add the tab to `app/dashboard/hr/layout.tsx`.

## Rollout
1. Migration on both DBs. Back up first, add the column only.
2. Build and verify on RE. Click-test with real data and check the scores look sane against what you know about the drivers.
3. Mirror to Impala.

## Open questions (defaults in bold)
- Estimate past revenue from maintenance records? **Yes, marked "est."** The alternative is to show revenue only from the date drivers start being recorded on daily reports.
- Can a bus have two drivers on one daily report (driver + co-driver)? **No, one driver per report.** If yes, revenue would be split between them.
- Are the weights right (revenue 40 / tires 20 / parts 15 / cost 15 / damages 10)? **Yes until you say otherwise.**
