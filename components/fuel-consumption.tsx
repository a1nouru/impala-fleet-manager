"use client";

import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { financialService } from "@/services/financialService";
import { useTranslation } from "@/hooks/useTranslation";
import {
  analyzeFuel,
  FUEL_PRICE_PER_LITER,
  isFuelCategory,
  type FuelEntry,
  type Row,
  type Trip,
} from "@/lib/fuel/consumption";

const BAR = "#3b82f6";
const WORST = "#ef4444";

const fmt = (n: number | null, digits = 1) =>
  n == null ? "-" : n.toLocaleString("en-US", { maximumFractionDigits: digits });

export function FuelConsumption({ dateRange }: { dateRange: DateRange | undefined }) {
  const { t } = useTranslation("financials");
  const [data, setData] = useState<{ trips: Trip[]; fuel: FuelEntry[] } | null>(null);
  const [corridor, setCorridor] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [reports, standalone] = await Promise.all([
          financialService.getDailyReports(),
          financialService.getStandaloneExpenses(),
        ]);
        const trips: Trip[] = [];
        const fuel: FuelEntry[] = [];
        for (const r of reports) {
          const plate = r.vehicles?.plate || "Unknown";
          trips.push({ vehicleId: r.vehicle_id, plate, date: r.report_date, route: r.route || null });
          for (const e of r.daily_expenses ?? []) {
            if (!isFuelCategory(e.category)) continue;
            fuel.push({
              vehicleId: r.vehicle_id,
              plate,
              date: r.report_date,
              route: r.route || null,
              liters: e.amount / FUEL_PRICE_PER_LITER,
              driver: e.driver_name ?? null,
            });
          }
        }
        for (const e of standalone) {
          if (!isFuelCategory(e.category) || !e.vehicle_id || !e.expense_date) continue;
          fuel.push({
            vehicleId: e.vehicle_id,
            plate: e.vehicles?.plate || "Unknown",
            date: e.expense_date,
            route: e.route || null,
            liters: e.amount / FUEL_PRICE_PER_LITER,
            driver: e.driver_name ?? null,
          });
        }
        setData({ trips, fuel });
      } catch {
        toast({ title: "Error", description: t("analytics.fuel.failedToLoad"), variant: "destructive" });
        setData({ trips: [], fuel: [] });
      }
    })();
  }, []);

  const corridors = useMemo(() => {
    if (!data || !dateRange?.from || !dateRange?.to) return [];
    return analyzeFuel(
      data.trips,
      data.fuel,
      format(dateRange.from, "yyyy-MM-dd"),
      format(dateRange.to, "yyyy-MM-dd")
    ).filter((c) => c.total.liters > 0);
  }, [data, dateRange]);

  const current = corridors.find((c) => c.corridor === corridor) ?? corridors[0];
  const unit = current?.unit ?? "L/100km";

  const chart = (rows: Row[], key: "liters" | "rate", label: (r: Row) => string, highlight?: string) => (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows.map((r) => ({ ...r, label: label(r) }))} margin={{ left: -10, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(v: number) => [`${fmt(v)} ${key === "rate" ? unit : "L"}`, key === "rate" ? unit : t("analytics.fuel.liters")]}
          labelFormatter={(l, p) => {
            const r = p?.[0]?.payload as Row | undefined;
            return r ? `${l} · ${r.trips} ${t("analytics.fuel.trips")} · ${fmt(r.liters, 0)} L` : l;
          }}
        />
        <Bar dataKey={key} radius={[4, 4, 0, 0]}>
          {rows.map((r) => (
            <Cell key={r.name} fill={highlight && r.name === highlight ? WORST : BAR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  const shortDate = (r: Row) => format(new Date(r.name + "T00:00:00"), "dd/MM");

  return (
    <Card className="col-span-3">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle>{t("analytics.fuel.title")}</CardTitle>
        {corridors.length > 0 && (
          <Select value={current?.corridor} onValueChange={setCorridor}>
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {corridors.map((c) => (
                <SelectItem key={c.corridor} value={c.corridor}>{c.corridor}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="h-[350px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !current ? (
          <div className="h-[350px] flex items-center justify-center">
            <p className="text-muted-foreground">{t("analytics.fuel.noData")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {fmt(current.total.liters, 0)} L · {current.total.trips} {t("analytics.fuel.trips")} ·{" "}
              {t("analytics.fuel.average")} <span className="font-semibold text-foreground">{fmt(current.total.rate)} {unit}</span>
            </p>
            <Tabs defaultValue="vehicles">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="daily">{t("analytics.fuel.daily")}</TabsTrigger>
                <TabsTrigger value="weekly">{t("analytics.fuel.weekly")}</TabsTrigger>
                <TabsTrigger value="vehicles">{t("analytics.fuel.vehicles")}</TabsTrigger>
                <TabsTrigger value="drivers">{t("analytics.fuel.drivers")}</TabsTrigger>
              </TabsList>
              <TabsContent value="daily">{chart(current.daily, "liters", shortDate)}</TabsContent>
              <TabsContent value="weekly">{chart(current.weekly, "rate", shortDate)}</TabsContent>
              <TabsContent value="vehicles">
                {chart(current.vehicles, "rate", (r) => r.name, current.worst?.name)}
              </TabsContent>
              <TabsContent value="drivers">
                {current.drivers.length > 0 ? (
                  chart(current.drivers, "rate", (r) => r.name, current.drivers[0]?.name)
                ) : (
                  <div className="h-[260px] flex items-center justify-center text-center px-6">
                    <p className="text-sm text-muted-foreground">{t("analytics.fuel.noDrivers")}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            {current.worst && (
              <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  {t("analytics.fuel.worstNote", {
                    plate: current.worst.name,
                    rate: `${fmt(current.worst.rate)} ${unit}`,
                    average: `${fmt(current.total.rate)} ${unit}`,
                  })}{" "}
                  {current.worst.driver
                    ? t("analytics.fuel.followUpDriver", { driver: current.worst.driver })
                    : t("analytics.fuel.followUp")}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
