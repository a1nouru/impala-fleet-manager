"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
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
import { Loader2, PlusCircle, Edit, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { BusStationOverviewPanels } from "@/components/bus-station-overview";
import { BusStationEntryDialog } from "@/components/bus-station-entry-dialog";
import {
  BUS_STATIONS,
  busStationLabel,
  type BusStationId,
} from "@/lib/bus-stations/stations";
import { entryTotals, slipsTotal } from "@/lib/bus-stations/revenue";
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
  const [deleting, setDeleting] = useState<BusStationEntry | null>(null);

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
          const totals = entryTotals(entry.bus_station_revenue_rows || []);
          acc.passenger += totals.passengerRevenue;
          acc.cargo += totals.cargoRevenue;
          acc.total += totals.total;
          acc.deposited += slipsTotal(entry.bus_station_revenue_slips || []);
          return acc;
        },
        { passenger: 0, cargo: 0, total: 0, deposited: 0 }
      ),
    [entries]
  );

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
            {/* Mobile: stacked cards — the 8-column table cannot fit a phone. */}
            <div className="space-y-3 md:hidden">
              {entries.map((entry) => {
                const totals = entryTotals(entry.bus_station_revenue_rows || []);
                const deposited = slipsTotal(entry.bus_station_revenue_slips || []);
                return (
                  <div key={entry.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{busStationLabel(entry.station)}</Badge>
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(entry);
                            setDialogOpen(true);
                          }}
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
                        {formatCurrency(totals.passengerRevenue)}
                      </span>
                      <span className="text-muted-foreground">
                        {t("busStations.cargo")}
                      </span>
                      <span className="text-right">
                        {formatCurrency(totals.cargoRevenue)}
                      </span>
                      <span className="text-muted-foreground">
                        {t("busStations.deposited")}
                      </span>
                      <span className="text-right">{formatCurrency(deposited)}</span>
                      <span className="font-medium">{t("busStations.total")}</span>
                      <span className="text-right font-bold">
                        {formatCurrency(totals.total)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="rounded-md bg-primary text-primary-foreground p-3 flex items-center justify-between text-sm">
                <span className="font-medium">{t("busStations.total")}</span>
                <span className="font-bold">{formatCurrency(grand.total)}</span>
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
                    <TableHead className="text-right">{t("busStations.total")}</TableHead>
                    <TableHead className="text-right">{t("busStations.deposited")}</TableHead>
                    <TableHead className="text-right">{t("busStations.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const totals = entryTotals(entry.bus_station_revenue_rows || []);
                    const deposited = slipsTotal(entry.bus_station_revenue_slips || []);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Badge variant="outline">{busStationLabel(entry.station)}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {entryPeriod(entry)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(entry.bus_station_revenue_rows || []).length}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(totals.passengerRevenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(totals.cargoRevenue)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(totals.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(deposited)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(entry);
                              setDialogOpen(true);
                            }}
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
                        </TableCell>
                      </TableRow>
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
                    <TableCell className="text-right font-bold">
                      {formatCurrency(grand.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(grand.deposited)}
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
