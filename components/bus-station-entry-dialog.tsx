"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Eye } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/context/AuthContext";
import { vehicleService } from "@/services/vehicleService";
import { openStoredFile } from "@/lib/storage-url";
import { BUS_STATIONS, type BusStationId } from "@/lib/bus-stations/stations";
import {
  entryTotals,
  passengerRevenue,
  rowTotal,
  selectableVehicles,
  slipsTotal,
} from "@/lib/bus-stations/revenue";
import {
  busStationService,
  type BusStationEntry,
  type RowInput,
  type SlipInput,
} from "@/services/busStationService";

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "AOA" });

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface DraftRow extends RowInput {
  key: string;
}

interface DraftSlip extends SlipInput {
  key: string;
}

function blankRow(): DraftRow {
  return {
    key: newKey(),
    vehicle_id: "",
    start_date: "",
    end_date: "",
    passenger_count: 0,
    cargo_amount: 0,
  };
}

export function BusStationEntryDialog({
  open,
  onOpenChange,
  entry,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: BusStationEntry | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation("financials");
  const { user } = useAuth() as { user?: { email?: string } | null };

  const [vehicles, setVehicles] = useState<{ id: string; plate: string }[]>([]);
  const [station, setStation] = useState<BusStationId>("mbanza_congo");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([blankRow()]);
  const [slips, setSlips] = useState<DraftSlip[]>([]);
  const [removedSlipIds, setRemovedSlipIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    vehicleService
      .getVehicles()
      .then((data: any[]) =>
        // Quarantined ghost plates ("LDA-29-14-AE..") must never be selectable.
        setVehicles(
          selectableVehicles(data || []).map((v: any) => ({ id: v.id, plate: v.plate }))
        )
      )
      .catch(() => setVehicles([]));
  }, []);

  // Reset the form each time the dialog opens, seeded from `entry` when editing.
  useEffect(() => {
    if (!open) return;
    setRemovedSlipIds([]);
    if (entry) {
      setStation(entry.station);
      setNotes(entry.notes || "");
      setRows(
        (entry.bus_station_revenue_rows || []).map((r) => ({
          key: r.id,
          vehicle_id: r.vehicle_id,
          start_date: r.start_date,
          end_date: r.end_date,
          passenger_count: Number(r.passenger_count) || 0,
          cargo_amount: Number(r.cargo_amount) || 0,
        }))
      );
      setSlips(
        (entry.bus_station_revenue_slips || []).map((s) => ({
          key: s.id,
          id: s.id,
          slip_url: s.slip_url,
          file_name: s.file_name || undefined,
          file_size: s.file_size || undefined,
          amount: s.amount,
          deposit_date: s.deposit_date,
        }))
      );
    } else {
      setStation("mbanza_congo");
      setNotes("");
      setRows([blankRow()]);
      setSlips([]);
    }
  }, [open, entry]);

  const totals = useMemo(() => entryTotals(rows), [rows]);
  const deposited = useMemo(() => slipsTotal(slips), [slips]);
  const variance = deposited - totals.total;

  const usedVehicleIds = useMemo(
    () => new Set(rows.map((r) => r.vehicle_id).filter(Boolean)),
    [rows]
  );

  const updateRow = (key: string, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const updateSlip = (key: string, patch: Partial<DraftSlip>) =>
    setSlips((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const removeSlip = (slip: DraftSlip) => {
    if (slip.id) setRemovedSlipIds((prev) => [...prev, slip.id as string]);
    setSlips((prev) => prev.filter((s) => s.key !== slip.key));
  };

  const validate = (): string | null => {
    const filled = rows.filter((r) => r.vehicle_id);
    if (!filled.length) return t("busStations.errors.noRows");
    for (const row of filled) {
      if (!row.start_date || !row.end_date) return t("busStations.errors.missingDates");
      if (row.end_date < row.start_date) return t("busStations.errors.badDateOrder");
    }
    const ids = filled.map((r) => r.vehicle_id);
    if (new Set(ids).size !== ids.length) return t("busStations.errors.duplicateVehicle");
    return null;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) {
      toast({
        title: t("busStations.errors.title"),
        description: problem,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payloadRows: RowInput[] = rows
        .filter((r) => r.vehicle_id)
        .map(({ key, ...row }) => ({
          ...row,
          passenger_count: Number(row.passenger_count) || 0,
          cargo_amount: Number(row.cargo_amount) || 0,
        }));

      const payloadSlips: SlipInput[] = slips.map(({ key, ...slip }) => slip);

      if (entry) {
        await busStationService.updateEntryComplete(
          entry.id,
          { station, notes },
          payloadRows,
          payloadSlips,
          removedSlipIds
        );
      } else {
        await busStationService.createEntryComplete(
          { station, notes, created_by: user?.email ?? null },
          payloadRows,
          payloadSlips
        );
      }

      toast({
        title: t("busStations.saved"),
        description: t("busStations.savedBody"),
      });
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      toast({
        title: t("busStations.errors.title"),
        description: error?.message || t("busStations.errors.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-6xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {entry ? t("busStations.editEntry") : t("busStations.newEntry")}
          </DialogTitle>
        </DialogHeader>

        {/* Station selection sits ABOVE the vehicle rows: an entry is per station. */}
        <div className="grid gap-2 w-full sm:max-w-sm">
          <Label>{t("busStations.busStation")}</Label>
          <Select value={station} onValueChange={(v) => setStation(v as BusStationId)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUS_STATIONS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vehicle rows: responsive cards, never a horizontally scrolling table. */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{t("busStations.vehicles")}</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRows((p) => [...p, blankRow()])}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("busStations.addRow")}
            </Button>
          </div>

          {rows.map((row) => (
            <div
              key={row.key}
              className="rounded-md border p-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(140px,1.1fr)_minmax(220px,1.5fr)_minmax(200px,1.3fr)_minmax(110px,0.9fr)_minmax(150px,auto)] xl:items-end"
            >
              <div className="grid gap-1.5 min-w-0">
                <Label className="text-xs text-muted-foreground">
                  {t("busStations.vehicle")}
                </Label>
                <Select
                  value={row.vehicle_id}
                  onValueChange={(v) => updateRow(row.key, { vehicle_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("busStations.selectVehicle")} />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem
                        key={v.id}
                        value={v.id}
                        disabled={usedVehicleIds.has(v.id) && v.id !== row.vehicle_id}
                      >
                        {v.plate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5 min-w-0">
                <Label className="text-xs text-muted-foreground">
                  {t("busStations.dateRange")}
                </Label>
                <div className="flex items-center gap-1 min-w-0">
                  <Input
                    type="date"
                    className="min-w-0 flex-1"
                    value={row.start_date}
                    onChange={(e) => updateRow(row.key, { start_date: e.target.value })}
                  />
                  <span className="text-muted-foreground shrink-0">–</span>
                  <Input
                    type="date"
                    className="min-w-0 flex-1"
                    value={row.end_date}
                    onChange={(e) => updateRow(row.key, { end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-1.5 min-w-0">
                <Label className="text-xs text-muted-foreground">
                  {t("busStations.revenue")} ({t("busStations.passengers")})
                </Label>
                {/* Passenger COUNT only — the Kwanza figure is derived. */}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="w-24"
                    placeholder={t("busStations.passengersPlaceholder")}
                    value={row.passenger_count || ""}
                    onChange={(e) =>
                      updateRow(row.key, {
                        passenger_count: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    = {formatCurrency(passengerRevenue(row.passenger_count))}
                  </span>
                </div>
              </div>

              <div className="grid gap-1.5 min-w-0">
                <Label className="text-xs text-muted-foreground">
                  {t("busStations.cargo")}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={row.cargo_amount || ""}
                  onChange={(e) =>
                    updateRow(row.key, { cargo_amount: Number(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-t pt-2 sm:col-span-2 xl:col-span-1 xl:border-t-0 xl:pt-0 xl:justify-end">
                <span className="text-xs text-muted-foreground xl:hidden">
                  {t("busStations.total")}
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-semibold whitespace-nowrap">
                    {formatCurrency(rowTotal(row))}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                    disabled={rows.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {/* Grand totals for the entry. */}
          <div className="rounded-md border bg-muted/50 p-3 flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              {t("busStations.passengers")}:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(totals.passengerRevenue)}
              </span>
            </span>
            <span className="text-muted-foreground">
              {t("busStations.cargo")}:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(totals.cargoRevenue)}
              </span>
            </span>
            <span className="text-muted-foreground">
              {t("busStations.total")}:{" "}
              <span className="font-bold text-foreground">
                {formatCurrency(totals.total)}
              </span>
            </span>
          </div>
        </div>

        {/* Bank slips sit BELOW all vehicle entry. */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{t("busStations.bankSlips")}</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSlips((prev) => [
                  ...prev,
                  { key: newKey(), amount: null, deposit_date: null },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("busStations.addSlip")}
            </Button>
          </div>

          {slips.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("busStations.noSlips")}</p>
          ) : (
            <div className="space-y-2">
              {slips.map((slip) => (
                <div
                  key={slip.key}
                  className="flex flex-col gap-2 border rounded-md p-2 sm:flex-row sm:flex-wrap sm:items-center"
                >
                  {slip.id ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => openStoredFile(slip.slip_url as string)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {slip.file_name || t("busStations.viewSlip")}
                    </Button>
                  ) : (
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      className="w-full sm:max-w-[220px]"
                      onChange={(e) =>
                        updateSlip(slip.key, { file: e.target.files?.[0] })
                      }
                    />
                  )}
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full sm:max-w-[140px]"
                    placeholder={t("busStations.amount")}
                    value={slip.amount ?? ""}
                    onChange={(e) =>
                      updateSlip(slip.key, {
                        amount: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      className="w-full sm:max-w-[170px]"
                      value={slip.deposit_date ?? ""}
                      onChange={(e) =>
                        updateSlip(slip.key, { deposit_date: e.target.value || null })
                      }
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeSlip(slip)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                {t("busStations.deposited")} {formatCurrency(deposited)} ·{" "}
                <span className={variance < 0 ? "text-red-600" : "text-green-600"}>
                  {t("busStations.variance")} {formatCurrency(variance)}
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label>{t("busStations.notes")}</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("buttons.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("buttons.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
