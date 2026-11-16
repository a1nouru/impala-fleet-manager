"use client";

import { useEffect, useMemo, useState } from "react";
import { format, subMonths, startOfMonth } from "date-fns";
import { Award, CircleDot, Disc, Gauge, Loader2, Trophy, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { RadarChart } from "@/components/charts/radar-chart";
import { RadarGrid } from "@/components/charts/radar-grid";
import { RadarAxis } from "@/components/charts/radar-axis";
import { RadarLabels } from "@/components/charts/radar-labels";
import { RadarArea } from "@/components/charts/radar-area";
import { hrService, type MaintenanceRow } from "@/services/hrService";
import {
  COMPONENTS, MIN_DAYS_DRIVEN, TIERS, parsePart, scoreDrivers,
  type ComponentKey, type DriverScore, type Tier,
} from "@/lib/drivers/score";

const COMPONENT_COLORS: Record<ComponentKey, string> = {
  revenue: "#18181b",
  tires: "#2f5bd3",
  clutch: "#c2410c",
  brakes: "#f59e0b",
  parts: "#6b93f0",
  cost: "#a5b4fc",
  damages: "#d4d4d8",
};

const TIER_BADGE: Record<Tier, { label: string; className: string }> = {
  raise: { label: "Raise-eligible", className: "bg-emerald-600 text-white hover:bg-emerald-600" },
  good: { label: "Good", className: "bg-zinc-200 text-zinc-900 hover:bg-zinc-200" },
  watch: { label: "Watch", className: "bg-amber-100 text-amber-900 hover:bg-amber-100" },
  insufficient: { label: "Not enough data", className: "bg-transparent text-muted-foreground border border-dashed hover:bg-transparent" },
};

const PRESETS = [
  { label: "This month", months: 0 },
  { label: "Last 3 months", months: 2 },
  { label: "Last 6 months", months: 5 },
] as const;

const aoa = (n: number) => `AOA ${Math.round(n).toLocaleString("en-US")}`;
const one = (n: number) => n.toFixed(1);
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const rangeFor = (months: number) => ({ from: iso(startOfMonth(subMonths(new Date(), months))), to: iso(new Date()) });
const rowsAspect = (rows: number) => `720 / ${rows * 30 + 36}`;

export default function DriverRecordsPage() {
  const [range, setRange] = useState(() => rangeFor(2));
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<DriverScore[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRow[]>([]);
  const [selected, setSelected] = useState<DriverScore | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    hrService
      .getDriverRecordInputs(range.from, range.to)
      .then((input) => {
        if (cancelled) return;
        setScores(scoreDrivers({ ...range, ...input }));
        setMaintenance(input.maintenance);
      })
      .catch(() => toast({ title: "Error", description: "Failed to load driver records.", variant: "destructive" }))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [range]);

  const ranked = scores.filter((s) => s.score !== null);
  const totalDays = scores.reduce((a, s) => a + s.daysDriven, 0);
  const estimatedDays = scores.reduce((a, s) => a + s.estimatedDays, 0);

  const scoreData = ranked.map((s) => ({ name: s.name, ...s.points }));
  const wearData = ranked.map((s) => ({ name: s.name, tires: +one(s.per30.tires), clutch: +one(s.per30.clutches), brakes: +one(s.per30.brakes), parts: +one(s.per30.wearParts) }));
  const revenueData = [...ranked]
    .sort((a, b) => b.revenuePerDay - a.revenuePerDay)
    .map((s) => ({ name: s.name, revenue: Math.round(s.revenuePerDay) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Trophy className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">Driver Records</h1>
        <Badge variant="outline">{ranked.length} drivers ranked</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={range.from} max={range.to}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={range.to} min={range.from}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
          {PRESETS.map((p) => (
            <Button key={p.label} variant="ghost" onClick={() => setRange(rangeFor(p.months))}>{p.label}</Button>
          ))}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : (
        <>
          {estimatedDays > 0 && (
            <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
              {estimatedDays} of {totalDays} driving days have no driver on the daily report. They are assigned
              (<span className="font-medium">est.</span>) to the driver of the nearest maintenance record on the same
              vehicle within 7 days. New operational reports now require a driver.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi icon={Award} title="Raise-eligible" value={ranked.filter((s) => s.tier === "raise").length}
              note={`Score ${TIERS.raise}+ of ${ranked.length} ranked`} />
            <Kpi icon={Gauge} title="Median score" value={median(ranked.map((s) => s.score!))}
              note={`Drivers with ${MIN_DAYS_DRIVEN}+ days driven`} />
            <Kpi icon={CircleDot} title="Tires changed" value={scores.reduce((a, s) => a + s.tires, 0)}
              note="Attributed to drivers" />
            <Kpi icon={Disc} title="Clutch discs replaced" value={scores.reduce((a, s) => a + s.clutches, 0)}
              note="Disco de embreagem" />
            <Kpi icon={Wrench} title="Spare parts replaced" value={scores.reduce((a, s) => a + s.wearParts, 0)}
              note="Excludes oil, filters, silicone" />
          </div>

          {ranked.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              No driver has {MIN_DAYS_DRIVEN}+ days driven in this period. Widen the date range.
            </CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Score breakdown</CardTitle>
                  <Legend items={COMPONENTS.map((c) => ({ label: `${c.label} (${c.weight})`, color: COMPONENT_COLORS[c.key] }))} />
                </CardHeader>
                <CardContent>
                  <BarChart className="w-full" data={scoreData} orientation="horizontal" stacked stackGap={2} barGap={0.45}
                    aspectRatio={rowsAspect(scoreData.length)} margin={{ left: 210, right: 16, top: 4, bottom: 4 }}>
                    {COMPONENTS.map((c) => <Bar key={c.key} dataKey={c.key} fill={COMPONENT_COLORS[c.key]} />)}
                    <BarYAxis />
                    <ChartTooltip showDatePill={false} showCrosshair={false}
                      rows={(p) => COMPONENTS.map((c) => ({ color: COMPONENT_COLORS[c.key], label: c.label, value: `${p[c.key]} / ${c.weight}` }))} />
                  </BarChart>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tires, clutch, brakes & spare parts per 30 days driven</CardTitle>
                    <Legend items={[{ label: "Tires", color: COMPONENT_COLORS.tires }, { label: "Clutch discs", color: COMPONENT_COLORS.clutch }, { label: "Brakes", color: COMPONENT_COLORS.brakes }, { label: "Spare parts", color: COMPONENT_COLORS.parts }]} />
                  </CardHeader>
                  <CardContent>
                    <BarChart className="w-full" data={wearData} orientation="horizontal" stacked stackGap={2} barGap={0.45}
                      aspectRatio={rowsAspect(wearData.length)} margin={{ left: 210, right: 16, top: 4, bottom: 4 }}>
                      <Bar dataKey="tires" fill={COMPONENT_COLORS.tires} />
                      <Bar dataKey="clutch" fill={COMPONENT_COLORS.clutch} />
                      <Bar dataKey="brakes" fill={COMPONENT_COLORS.brakes} />
                      <Bar dataKey="parts" fill={COMPONENT_COLORS.parts} />
                      <BarYAxis />
                      <ChartTooltip showDatePill={false} showCrosshair={false} />
                    </BarChart>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Revenue per day driven (AOA)</CardTitle></CardHeader>
                  <CardContent>
                    <BarChart className="w-full" data={revenueData} orientation="horizontal" barGap={0.45}
                      aspectRatio={rowsAspect(revenueData.length)} margin={{ left: 210, right: 16, top: 4, bottom: 4 }}>
                      <Bar dataKey="revenue" fill={COMPONENT_COLORS.revenue} lineCap="round" />
                      <BarYAxis />
                      <ChartTooltip showDatePill={false} showCrosshair={false}
                        rows={(p) => [{ color: COMPONENT_COLORS.revenue, label: "Revenue / day", value: aoa(Number(p.revenue)) }]} />
                    </BarChart>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {ranked.length > 0 && <LowestScores ranked={ranked} onSelect={setSelected} />}

          <Card>
            <CardHeader><CardTitle className="text-base">All drivers</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Days driven</TableHead>
                    <TableHead className="text-right">Revenue / day</TableHead>
                    <TableHead className="text-right">Tires</TableHead>
                    <TableHead className="text-right">Clutch discs</TableHead>
                    <TableHead className="text-right">Brakes</TableHead>
                    <TableHead className="text-right">Spare parts</TableHead>
                    <TableHead className="text-right">Maintenance cost</TableHead>
                    <TableHead className="text-right">Damages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.map((s, i) => (
                    <TableRow key={s.driverId} className="cursor-pointer" onClick={() => setSelected(s)}>
                      <TableCell className="text-muted-foreground">{s.score === null ? "–" : i + 1}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><Badge className={TIER_BADGE[s.tier].className}>{TIER_BADGE[s.tier].label}</Badge></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{s.score ?? "–"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.daysDriven}{s.estimatedDays > 0 && <span className="ml-1 text-xs text-muted-foreground">({s.estimatedDays} est.)</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{aoa(s.revenuePerDay)}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.tires}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.clutches}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.brakes}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.wearParts}</TableCell>
                      <TableCell className="text-right tabular-nums">{aoa(s.maintenanceCost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.damageCount ? `${s.damageCount} · ${aoa(s.damageCost)}` : "0"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <DriverDialog driver={selected} ranked={ranked} maintenance={maintenance} range={range} onClose={() => setSelected(null)} />
    </div>
  );
}

function DriverDialog({ driver, ranked, maintenance, range, onClose }: {
  driver: DriverScore | null;
  ranked: DriverScore[];
  maintenance: MaintenanceRow[];
  range: { from: string; to: string };
  onClose: () => void;
}) {
  const events = useMemo(
    () => driver
      ? maintenance
          .filter((m) => m.driver_id === driver.driverId && m.date >= range.from && m.date <= range.to)
          .sort((a, b) => b.date.localeCompare(a.date))
      : [],
    [driver, maintenance, range],
  );
  if (!driver) return null;

  const metrics = COMPONENTS.map((c) => ({ key: c.key, label: c.label }));
  const asPercent = (s: DriverScore) =>
    Object.fromEntries(COMPONENTS.map((c) => [c.key, s.points ? (s.points[c.key] / c.weight) * 100 : 0]));
  const fleetMedian = Object.fromEntries(
    COMPONENTS.map((c) => [c.key, median(ranked.map((s) => asPercent(s)[c.key]))]),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            {driver.name}
            <Badge className={TIER_BADGE[driver.tier].className}>{TIER_BADGE[driver.tier].label}</Badge>
          </DialogTitle>
          <DialogDescription>
            {driver.score === null
              ? `${driver.daysDriven} days driven. Needs ${MIN_DAYS_DRIVEN} to be ranked.`
              : `Score ${driver.score} / 100 · ${driver.daysDriven} days driven${driver.estimatedDays ? ` (${driver.estimatedDays} est.)` : ""}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[300px_1fr]">
          {driver.points ? (
            <div>
              <RadarChart data={[
                { label: "Fleet median", color: "#a1a1aa", values: fleetMedian },
                { label: driver.name, color: "#2f5bd3", values: asPercent(driver) },
              ]} metrics={metrics} size={300} margin={56}>
                <RadarGrid />
                <RadarAxis />
                <RadarLabels fontSize={11} offset={14} />
                <RadarArea index={0} showPoints={false} />
                <RadarArea index={1} />
              </RadarChart>
              <Legend items={[{ label: driver.name, color: "#2f5bd3" }, { label: "Fleet median", color: "#a1a1aa" }]} />
            </div>
          ) : <div />}
          <dl className="grid grid-cols-[1fr_auto] content-start gap-x-4 gap-y-2 text-sm">
            {COMPONENTS.map((c) => (
              <div key={c.key} className="contents">
                <dt className="text-muted-foreground">{c.label}</dt>
                <dd className="text-right tabular-nums">{driver.points ? `${driver.points[c.key]} / ${c.weight}` : "–"}</dd>
              </div>
            ))}
            <dt className="text-muted-foreground">Revenue / day</dt><dd className="text-right tabular-nums">{aoa(driver.revenuePerDay)}</dd>
            <dt className="text-muted-foreground">Tires / 30 days</dt><dd className="text-right tabular-nums">{one(driver.per30.tires)}</dd>
            <dt className="text-muted-foreground">Clutch discs / 30 days</dt><dd className="text-right tabular-nums">{one(driver.per30.clutches)}</dd>
            <dt className="text-muted-foreground">Brakes / 30 days</dt><dd className="text-right tabular-nums">{one(driver.per30.brakes)}</dd>
            <dt className="text-muted-foreground">Spare parts / 30 days</dt><dd className="text-right tabular-nums">{one(driver.per30.wearParts)}</dd>
            <dt className="text-muted-foreground">Maintenance cost</dt><dd className="text-right tabular-nums">{aoa(driver.maintenanceCost)}</dd>
          </dl>
        </div>

        {driver.months.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">Tires, clutch, brakes & spare parts by month</h4>
            <BarChart className="w-full" data={driver.months.map((m) => ({ name: m.month, tires: m.tires, clutch: m.clutches, brakes: m.brakes, parts: m.wearParts }))}
              stacked stackGap={2} aspectRatio="3 / 1" margin={{ left: 32, right: 8, top: 8, bottom: 24 }}>
              <Bar dataKey="tires" fill={COMPONENT_COLORS.tires} />
              <Bar dataKey="clutch" fill={COMPONENT_COLORS.clutch} />
              <Bar dataKey="brakes" fill={COMPONENT_COLORS.brakes} />
              <Bar dataKey="parts" fill={COMPONENT_COLORS.parts} />
              <BarXAxis />
              <ChartTooltip showDatePill={false} showCrosshair={false} />
            </BarChart>
          </div>
        )}

        <div>
          <h4 className="mb-2 text-sm font-medium">Maintenance events ({events.length})</h4>
          <div className="divide-y rounded-md border">
            {events.length === 0 && <p className="p-3 text-sm text-muted-foreground">None in this period.</p>}
            {events.map((m) => (
              <div key={m.id} className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{m.date} · {m.vehicles?.plate ?? "—"}</span>
                  <span className="tabular-nums">{aoa(Number(m.cost ?? 0))}</span>
                </div>
                {m.description && <p className="text-muted-foreground">{m.description}</p>}
                <div className="flex flex-wrap gap-1">
                  {(m.parts ?? []).map((raw, i) => {
                    const part = parsePart(raw);
                    if (!part) return null;
                    return (
                      <Badge key={i} variant="outline" className={part.kind === "tire" ? "border-blue-300 text-blue-800" : part.kind === "clutch" ? "border-orange-300 text-orange-800" : part.kind === "brake" ? "border-amber-300 text-amber-800" : part.kind === "routine" ? "text-muted-foreground" : ""}>
                        {part.name}{part.qty !== 1 ? ` ×${part.qty}` : ""}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ icon: Icon, title, value, note }: { icon: typeof Award; title: string; value: number; note: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-sm" style={{ background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  );
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
}

const LOWEST_COUNT = 5;

/** Bottom of the ranking, with the components that cost each driver the most points. */
function LowestScores({ ranked, onSelect }: { ranked: DriverScore[]; onSelect: (s: DriverScore) => void }) {
  const lowest = [...ranked].sort((a, b) => a.score! - b.score!).slice(0, LOWEST_COUNT);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fewest points — where they lose them</CardTitle>
        <p className="text-sm text-muted-foreground">
          Points lost per component, out of its weight. Maintenance is counted against the driver it was logged on. Click a driver for their maintenance history.
        </p>
      </CardHeader>
      <CardContent className="divide-y">
        {lowest.map((s) => {
          const lost = COMPONENTS
            .map((c) => ({ ...c, lost: Math.round((c.weight - s.points![c.key]) * 10) / 10 }))
            .filter((c) => c.lost > 0)
            .sort((a, b) => b.lost - a.lost);
          return (
            <button key={s.driverId} type="button" onClick={() => onSelect(s)}
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 py-3 text-left hover:bg-muted/50">
              <span className="w-12 text-2xl font-semibold tabular-nums">{s.score}</span>
              <span className="min-w-40 flex-1">
                <span className="block font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.maintenanceEvents} maintenance logged · {aoa(s.maintenanceCost)} · {s.daysDriven} days
                </span>
              </span>
              <span className="flex flex-wrap gap-1">
                {lost.map((c) => (
                  <Badge key={c.key} variant="outline" className="gap-1.5 font-normal">
                    <span className="h-2 w-2 rounded-full" style={{ background: COMPONENT_COLORS[c.key] }} />
                    {c.label} −{c.lost}/{c.weight}
                  </Badge>
                ))}
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
