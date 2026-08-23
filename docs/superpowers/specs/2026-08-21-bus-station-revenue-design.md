# Bus Station Revenue — Design

Date: 2026-08-21
Applies to: `royalexpress-fleet-manager` AND `impala-fleet-manager` (mirrored repos)

## Purpose

Operators collect revenue at bus stations rather than on the bus. Today that money
has nowhere to live in the fleet manager: the Daily Reports tab is per-vehicle
per-day and does not fit a station clerk recording a week of takings for several
buses at once. This feature adds a `Bus Station Revenue` tab under Financials
where a clerk records, per station, a batch of vehicle rows (date range,
passenger count, cargo amount) and attaches the bank slips proving the money was
deposited.

## Scope

In scope:

- New `Bus Station Revenue` tab under Financials, in both repos.
- Overview band (summary panels + date range) at the top of that tab.
- Create / view / edit / delete of station entries with vehicle rows and bank slips.
- Bus station revenue folded into the Financial Analytics totals.
- `en` and `pt` translations.

Out of scope:

- Managing the station list from the UI. The two stations are a code constant.
- Making the 1,000 Kz passenger fare configurable.
- Fixing the pre-existing `get_financial_summary` bug (see Known Issues).

## Domain rules

- **Stations** are a fixed pair: `mbanza_congo` ("Mbanza Congo") and
  `nosso_centro` ("Nosso Centro"). Same two in both companies.
- **Passenger revenue is never typed in Kwanza.** The user types a passenger
  *count*; revenue is `count x PASSENGER_FARE_AOA` where the fare is the
  constant `1000`. Entering `20` yields `20 000 Kz`.
- **Cargo revenue is typed in Kwanza directly.** There is no cargo count.
- **Row total** = passenger revenue + cargo amount.
- **One row per vehicle per entry.** A plate already used in the entry is
  disabled in the row's vehicle dropdown, and the database enforces it too.
- **Each row carries its own date range** (`start_date`..`end_date`). The entry
  as a whole has no date range; its displayed period is the earliest start to
  the latest end across its rows.
- Only **selectable** vehicles may be chosen — `selectableVehicles()` from
  `lib/vehicles/plate.ts`, which excludes the quarantined `..`-suffixed ghost
  plates.

## Data model

Three new tables in each project's `public` schema.

### `bus_station_revenues` (entry / parent)

| column | type | notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `station` | text not null | check in (`mbanza_congo`, `nosso_centro`) |
| `notes` | text null | |
| `created_by` | text null | matches how sibling tables record the actor |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()` |

### `bus_station_revenue_rows` (vehicle row / child)

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `entry_id` | uuid not null | fk -> `bus_station_revenues(id)` ON DELETE CASCADE |
| `vehicle_id` | uuid not null | fk -> `vehicles(id)` |
| `start_date` | date not null | |
| `end_date` | date not null | check `end_date >= start_date` |
| `passenger_count` | integer not null default 0 | check `>= 0` |
| `passenger_revenue` | numeric(14,2) not null default 0 | persisted `count x fare` |
| `cargo_amount` | numeric(14,2) not null default 0 | check `>= 0` |
| `total_revenue` | numeric(14,2) GENERATED ALWAYS AS (`passenger_revenue + cargo_amount`) STORED | |
| `created_at` | timestamptz | default `now()` |

Constraints: `UNIQUE (entry_id, vehicle_id)`. Indexes on `entry_id`,
`vehicle_id`, and `start_date` (the analytics/overview filter column).

`passenger_revenue` is **persisted rather than generated from the fare
constant** so that if the fare ever changes, historical entries keep the amount
that was actually recorded.

### `bus_station_revenue_slips` (bank slips)

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `entry_id` | uuid not null | fk -> `bus_station_revenues(id)` ON DELETE CASCADE |
| `slip_url` | text not null | stored storage URL |
| `file_name` | text | |
| `file_size` | bigint | |
| `amount` | numeric(14,2) | deposited amount |
| `deposit_date` | date | |
| `created_at` | timestamptz | default `now()` |

Index on `entry_id`.

### RLS

Every new table gets RLS enabled with the single post-lockdown policy already in
use on the rental tables:

```sql
CREATE POLICY authenticated_all ON <table>
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Storage

Slips reuse the **existing private `bank-slips` bucket** under a
`bus-station/<entry_id>/` path prefix. No new bucket is created; the blanket
`authenticated` policies on `storage.objects` already cover this path. Files are
read back through `openStoredFile` / `signStoredUrl` in `lib/storage-url.ts`,
which mints a short-lived signed URL at click time.

## UI

Route: `app/dashboard/financials/bus-stations/page.tsx`.
Tab added to `app/dashboard/financials/layout.tsx` immediately after **Rental**.

### Overview band (top of page)

A date range picker (`components/ui/date-range-picker.tsx`, defaulting to the
last 30 days, same as Analytics) governs a row of summary panels:

- **Total Revenue** — all stations in range
- **Mbanza Congo** — that station's revenue in range
- **Nosso Centro** — that station's revenue in range
- **Total Deposited** — sum of bank slip amounts in range, with the variance
  against total revenue shown as the sub-line

Each panel additionally breaks out passenger vs cargo as a muted sub-line. Panels
use the same `Card` + icon + `text-2xl font-bold` shape as the Analytics summary
cards so the two pages read as one system. Rows are attributed to the range by
their `start_date`.

### Entries table

Below the overview, the list of saved entries: Station, Period, # Vehicles,
Passenger Revenue, Cargo Revenue, **Total**, Deposited, Actions
(view / edit / delete). It respects the overview's date range and adds a station
filter. Layout follows the Rental tab's table conventions, including the
`TableFooter` totals row and `ActionDropdown` for row actions.

### Create / Edit dialog

Station select sits **above** the vehicle table:

```
Bus Station:  [ Mbanza Congo v ]

 Vehicle        Date range          Revenue            Cargo      Total
 [LDA-.. v]     [01 Aug-07 Aug]     [ 20 ] = 20 000    [5 000]    25 000
 [LDA-.. v]     [08 Aug-14 Aug]     [ 13 ] = 13 000    [    0]    13 000
                                              GRAND TOTAL         38 000 Kz
                          [ + Add row ]

 Bank slip deposits
   [ file ] [ amount ] [ deposit date ]   [ + Add slip ]
   slip-aug.pdf - 30 000 Kz - 07 Aug      [view] [remove]
                             Deposited 30 000  -  Variance -8 000
```

- The **Revenue** cell is an integer passenger-count input with the computed
  Kwanza figure rendered read-only beside it. It is not directly editable in Kz.
- The **Cargo** cell is a Kwanza amount input.
- **Total** and **GRAND TOTAL** are computed live, never typed.
- **+ Add row** appends a blank row. Rows are removable. A save requires at
  least one row with a vehicle and a date range.
- Bank slips are optional and unlimited; each carries file + amount + date.
- Editing an existing entry loads its rows and slips; removed slips are deleted
  from storage on save.

Currency is formatted as AOA throughout, matching the other financial pages.

## Service layer

`services/busStationService.ts`, modelled on `services/rentalService.ts`
(including its defensive handling of "relation does not exist" and RLS errors so
a missing migration degrades to an empty list rather than a crashed page):

- `getEntries(filters?: { from?, to?, station? })` — entries with rows, joined
  vehicle plates, and slips
- `createEntryComplete(entry, rows, slipFiles)`
- `updateEntryComplete(entryId, entry, rows, slipFiles, removedSlipIds)`
- `deleteEntry(entryId)` — cascade delete plus storage cleanup
- `uploadSlip(file, entryId)`
- `getOverview(from, to)` — `{ total, byStation, passenger, cargo, deposited }`
- `getBusStationRevenueTotal(from, to)` — used by Analytics

`PASSENGER_FARE_AOA = 1000` is exported from `lib/constants.ts`, alongside the
existing fleet constants. Pure calculation helpers (row total, entry totals,
count -> revenue) live in `lib/bus-stations/revenue.ts` so they are unit-testable
without a database.

## Analytics integration

`app/dashboard/financials/analytics/page.tsx` calls
`busStationService.getBusStationRevenueTotal()` alongside the existing
`getFinancialSummary()` RPC, adds a fourth **Bus Station Revenue** summary card,
and includes that figure in the displayed Total Revenue and Net Balance.

The `get_financial_summary` RPC is deliberately **not** modified: the analytics
page is its only consumer, so doing this client-side avoids a stored-procedure
change on two separate production databases and keeps the new revenue stream
visible as its own line rather than silently folded into an existing total.

## i18n

New `busStations` section in `public/locales/en/financials.json` and
`public/locales/pt/financials.json`, plus a `navigation.busStations` key for the
tab label. Portuguese is the operating language for both companies, so the `pt`
strings are required, not optional.

## Error handling

- Save is a multi-step write (entry -> rows -> slip uploads -> slip records). If
  a later step fails, the created entry is deleted so no half-written entry is
  left behind, and the user sees a destructive toast.
- Uploads that fail leave no orphan DB rows; DB inserts that fail trigger removal
  of the just-uploaded object from storage.
- A missing migration (tables absent) renders an empty state with an explanatory
  message rather than an error, matching `rentalService`'s behaviour.

## Testing

- Unit tests for `lib/bus-stations/revenue.ts`: count -> revenue at the fare
  constant, row total with and without cargo, entry aggregation, deposited
  variance, empty and zero cases.
- Unit tests for the duplicate-vehicle guard and the `end_date >= start_date`
  validation.
- Manual verification in both apps: create an entry with two vehicles and a
  slip, confirm the overview panels and per-station split, edit it, delete it,
  and confirm the Analytics card reflects the change.

## Rollout

DDL is applied directly to each Supabase project — `hymravaveedguejtazsc`
(Royal Express) and `depesjavqihzrxswkcso` (Impala) — because the Impala
Supabase CLI link points at a stale project ref. A matching migration file is
committed to `supabase/migrations/` in both repos for the record.

The two repos are near-identical; every change here lands in both.

## Known issues (pre-existing, out of scope)

`public.get_financial_summary` sums only the legacy `ticket_revenue` column and
ignores `cash_revenue` and `tpa_revenue`, which is where the application has
been writing ticket money. Analytics' Total Revenue is therefore likely already
understating daily report revenue. This predates the feature and is left
untouched; it should be raised separately.
