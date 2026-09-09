"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO, startOfWeek, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Eye,
  Loader2,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { BusStationOverviewPanels } from "@/components/bus-station-overview";
import { BusStationEntryDialog } from "@/components/bus-station-entry-dialog";
import {
  BUS_STATIONS,
  busStationLabel,
  type BusStationId,
} from "@/lib/bus-stations/stations";
import { entryTotals, expensesTotal } from "@/lib/bus-stations/revenue";
import {
  busStationService,
  type BusStationEntry,
  type BusStationOverview,
} from "@/services/busStationService";

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "AOA" });

/** An entry's period is the span of its rows: earliest start to latest end. */
function entryPeriod(entry: BusStationEntry): string {
  const rows = entry.bus_station_revenue_rows || [];
  if (!rows.length) return "—";
  const start = rows.map((r) => r.start_date).sort()[0];
  const end = rows.map((r) => r.end_date).sort().slice(-1)[0];
  return start === end ? start : `${start} → ${end}`;
}

function entryStart(entry: BusStationEntry): string {
  const rows = entry.bus_station_revenue_rows || [];
  return rows.length
    ? rows.map((r) => r.start_date).sort()[0]
    : (entry.created_at || "").slice(0, 10);
}

function entryEnd(entry: BusStationEntry): string {
  const rows = entry.bus_station_revenue_rows || [];
  return rows.length
    ? rows.map((r) => r.end_date).sort().slice(-1)[0]
    : (entry.created_at || "").slice(0, 10);
}

function entrySums(entry: BusStationEntry) {
  const totals = entryTotals(entry.bus_station_revenue_rows || []);
  const spent = expensesTotal(entry.bus_station_expenses || []);
  return { ...totals, spent, net: totals.total - spent };
}

export default function BusStationsPage() {
  const { t } = useTranslation("financials");

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [station, setStation] = useState<BusStationId | "all">("all");

  const [entries, setEntries] = useState<BusStationEntry[]>([]);
  const [overview, setOverview] = useState<BusStationOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BusStationEntry | null>(null);
  const [viewing, setViewing] = useState(false);
  const [deleting, setDeleting] = useState<BusStationEntry | null>(null);
  // Explicit user toggles; a week without one defaults to open only when it is
  // the most recent week on screen.
  const [toggledWeeks, setToggledWeeks] = useState<Record<string, boolean>>({});

  // Past entries are a closed day's paper record: view only, no edit/delete.
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isLocked = (entry: BusStationEntry) => entryEnd(entry) < todayStr;

  const openEntry = (entry: BusStationEntry) => {
    setEditing(entry);
    setViewing(isLocked(entry));
    setDialogOpen(true);
  };

  const from = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const to = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

  const load = useCallback(async () => {
    if (!from || !to) return;
    setIsLoading(true);
    try {
      const [list, summary] = await Promise.all([
        busStationService.getEntries({ from, to, station }),
        busStationService.getOverview(from, to),
      ]);
      setEntries(list);
      setOverview(summary);
    } catch (error) {
      toast({
        title: t("busStations.errors.title"),
        description: t("busStations.errors.loadFailed"),
        variant: "destructive",
      });
      setEntries([]);
      setOverview(null);
    } finally {
      setIsLoading(false);
    }
  }, [from, to, station, t]);

  useEffect(() => {
    load();
  }, [load]);

  const grand = useMemo(
    () =>
      entries.reduce(
        (acc, entry) => {
          const s = entrySums(entry);
          acc.passenger += s.passengerRevenue;
          acc.cargo += s.cargoRevenue;
          acc.expenses += s.spent;
          acc.net += s.net;
          return acc;
        },
        { passenger: 0, cargo: 0, expenses: 0, net: 0 }
      ),
    [entries]
  );

  // Entries grouped into Monday–Sunday weeks, newest week first.
  const weeks = useMemo(() => {
    const map = new Map<string, BusStationEntry[]>();
    for (const entry of entries) {
      const key = format(
        startOfWeek(parseISO(entryStart(entry)), { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      );
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, list]) => {
        list.sort((a, b) => entryStart(b).localeCompare(entryStart(a)));
        const sums = list.reduce(
          (acc, entry) => {
            const s = entrySums(entry);
            acc.vehicles += (entry.bus_station_revenue_rows || []).length;
            acc.passenger += s.passengerRevenue;
            acc.cargo += s.cargoRevenue;
            acc.expenses += s.spent;
            acc.net += s.net;
            return acc;
          },
          { vehicles: 0, passenger: 0, cargo: 0, expenses: 0, net: 0 }
        );
        const monday = parseISO(key);
        return {
          key,
          list,
          sums,
          label: `${format(monday, "d MMM")} – ${format(addDays(monday, 6), "d MMM yyyy")}`,
        };
      });
  }, [entries]);

  const isWeekOpen = (key: string, index: number) =>
    toggledWeeks[key] ?? index === 0;
  const toggleWeek = (key: string, index: number) =>
    setToggledWeeks((prev) => ({ ...prev, [key]: !(prev[key] ?? index === 0) }));

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await busStationService.deleteEntry(deleting.id);
      toast({
        title: t("busStations.deleted"),
        description: t("busStations.deletedBody"),
      });
      setDeleting(null);
      load();
    } catch (error: any) {
      toast({
        title: t("busStations.errors.title"),
        description: error?.message || t("busStations.errors.deleteFailed"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{t("busStations.title")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          <Select
            value={station}
            onValueChange={(v) => setStation(v as BusStationId | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("busStations.allStations")}</SelectItem>
              {BUS_STATIONS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setEditing(null);
              setViewing(false);
              setDialogOpen(true);
            }}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            {t("busStations.newEntry")}
          </Button>
        </div>
      </div>

      <BusStationOverviewPanels overview={overview} isLoading={isLoading} />

      <Card>
        <CardHeader>
          <CardTitle>{t("busStations.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("busStations.noEntries")}
            </p>
          ) : (
            <>
            {/* Mobile: week strips, each expanding into stacked entry cards. */}
            <div className="space-y-3 md:hidden">
              {weeks.map((week, wi) => {
                const open = isWeekOpen(week.key, wi);
                return (
                  <Fragment key={week.key}>
                    <button
                      type="button"
                      className="w-full rounded-md bg-muted px-3 py-2.5 flex items-center justify-between gap-2 text-sm font-medium"
                      onClick={() => toggleWeek(week.key, wi)}
                    >
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        {open ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        {week.label}
                        <Badge variant="secondary">{week.list.length}</Badge>
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(week.sums.net)}
                      </span>
                    </button>
                    {open &&
                      week.list.map((entry) => {
                        const s = entrySums(entry);
                        const locked = isLocked(entry);
                        return (
                          <div key={entry.id} className="rounded-md border p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline">
                                {busStationLabel(entry.station)}
                              </Badge>
                              <div className="flex items-center">
                                {locked ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEntry(entry)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEntry(entry)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setDeleting(entry)}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {entryPeriod(entry)} ·{" "}
                              {(entry.bus_station_revenue_rows || []).length}{" "}
                              {t("busStations.vehicles").toLowerCase()}
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                              <span className="text-muted-foreground">
                                {t("busStations.passengers")}
                              </span>
                              <span className="text-right">
                                {formatCurrency(s.passengerRevenue)}
                              </span>
                              <span className="text-muted-foreground">
                                {t("busStations.cargo")}
                              </span>
                              <span className="text-right">
                                {formatCurrency(s.cargoRevenue)}
                              </span>
                              {s.spent > 0 && (
                                <>
                                  <span className="text-muted-foreground">
                                    {t("busStations.expensesTitle")}
                                  </span>
                                  <span className="text-right text-red-600">
                                    − {formatCurrency(s.spent)}
                                  </span>
                                </>
                              )}
                              <span className="font-medium">
                                {t("busStations.total")}
                              </span>
                              <span className="text-right font-bold">
                                {formatCurrency(s.net)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </Fragment>
                );
              })}
              <div className="rounded-md bg-primary text-primary-foreground p-3 flex items-center justify-between text-sm">
                <span className="font-medium">{t("busStations.total")}</span>
                <span className="font-bold">{formatCurrency(grand.net)}</span>
              </div>
            </div>

            {/* Desktop: full table. */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("busStations.busStation")}</TableHead>
                    <TableHead>{t("busStations.period")}</TableHead>
                    <TableHead className="text-right">{t("busStations.vehicles")}</TableHead>
                    <TableHead className="text-right">{t("busStations.passengers")}</TableHead>
                    <TableHead className="text-right">{t("busStations.cargo")}</TableHead>
                    <TableHead className="text-right">{t("busStations.expensesTitle")}</TableHead>
                    <TableHead className="text-right">{t("busStations.total")}</TableHead>
                    <TableHead className="text-right">{t("busStations.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeks.map((week, wi) => {
                    const open = isWeekOpen(week.key, wi);
                    return (
                      <Fragment key={week.key}>
                        <TableRow
                          className="cursor-pointer select-none bg-muted/50 hover:bg-muted"
                          onClick={() => toggleWeek(week.key, wi)}
                        >
                          <TableCell colSpan={2} className="font-medium whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              {open ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {week.label}
                              <Badge variant="secondary">{week.list.length}</Badge>
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {week.sums.vehicles}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(week.sums.passenger)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(week.sums.cargo)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {week.sums.expenses > 0
                              ? `− ${formatCurrency(week.sums.expenses)}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(week.sums.net)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                        {open &&
                          week.list.map((entry) => {
                            const s = entrySums(entry);
                            const locked = isLocked(entry);
                            return (
                              <TableRow key={entry.id}>
                                <TableCell>
                                  <Badge variant="outline">
                                    {busStationLabel(entry.station)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {entryPeriod(entry)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {(entry.bus_station_revenue_rows || []).length}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(s.passengerRevenue)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(s.cargoRevenue)}
                                </TableCell>
                                <TableCell className="text-right text-red-600">
                                  {s.spent > 0 ? `− ${formatCurrency(s.spent)}` : "—"}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(s.net)}
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                  {locked ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEntry(entry)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openEntry(entry)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setDeleting(entry)}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>{t("busStations.total")}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(grand.passenger)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(grand.cargo)}
                    </TableCell>
                    <TableCell className="text-right">
                      {grand.expenses > 0 ? `− ${formatCurrency(grand.expenses)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(grand.net)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <BusStationEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        readOnly={viewing}
        onSaved={load}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("busStations.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("busStations.confirmDeleteBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
