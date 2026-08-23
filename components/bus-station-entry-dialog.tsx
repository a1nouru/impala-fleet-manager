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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

/** An already-stored slip being kept or removed while editing. */
interface ExistingSlip {
  id: string;
  slip_url: string;
  file_name?: string;
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
  const [existingSlips, setExistingSlips] = useState<ExistingSlip[]>([]);
  const [slipFiles, setSlipFiles] = useState<File[]>([]);
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
    setSlipFiles([]);
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
      setExistingSlips(
        (entry.bus_station_revenue_slips || []).map((s) => ({
          id: s.id,
          slip_url: s.slip_url,
          file_name: s.file_name || undefined,
        }))
      );
    } else {
      setStation("mbanza_congo");
      setNotes("");
      setRows([blankRow()]);
      setExistingSlips([]);
    }
  }, [open, entry]);

  const totals = useMemo(() => entryTotals(rows), [rows]);

  const usedVehicleIds = useMemo(
    () => new Set(rows.map((r) => r.vehicle_id).filter(Boolean)),
    [rows]
  );

  const updateRow = (key: string, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const removeRow = (key: string) =>
    setRows((prev) => prev.filter((r) => r.key !== key));

  const removeExistingSlip = (slip: ExistingSlip) => {
    setRemovedSlipIds((prev) => [...prev, slip.id]);
    setExistingSlips((prev) => prev.filter((s) => s.id !== slip.id));
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
    // A bank slip is mandatory: at least one new file or one kept existing slip.
    if (slipFiles.length === 0 && existingSlips.length === 0)
      return t("busStations.errors.noSlip");
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

      const payloadSlips: SlipInput[] = [
        // Kept existing slips pass through untouched (attachSlips skips id'd ones).
        ...existingSlips.map((s) => ({
          id: s.id,
          slip_url: s.slip_url,
          amount: null,
          deposit_date: null,
        })),
        ...slipFiles.map((file) => ({ file, amount: null, deposit_date: null })),
      ];

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

  const vehicleSelect = (row: DraftRow) => (
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
  );

  const passengerInput = (row: DraftRow) => (
    <Input
      type="number"
      min={0}
      step={1}
      className="w-16 px-1.5"
      placeholder="0"
      value={row.passenger_count || ""}
      onChange={(e) =>
        updateRow(row.key, { passenger_count: Number(e.target.value) || 0 })
      }
    />
  );

  const cargoInput = (row: DraftRow) => (
    <Input
      type="number"
      min={0}
      step="0.01"
      className="w-full min-w-[80px] px-1.5"
      placeholder="0"
      value={row.cargo_amount || ""}
      onChange={(e) => updateRow(row.key, { cargo_amount: Number(e.target.value) || 0 })}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The base DialogContent carries sm:max-w-lg — the wide override MUST use
          the same sm: variant or it silently loses and the dialog stays 512px. */}
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-6xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
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

        <div className="space-y-3">
          <h4 className="font-medium">{t("busStations.vehicles")}</h4>

          {/* table-fixed + percentage columns: the table can never grow wider
              than the dialog, so nothing is ever clipped or scrolled. */}
          <div className="hidden md:block rounded-md border">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="p-2 w-[17%]">
                    {t("busStations.vehicle")}
                  </TableHead>
                  <TableHead className="p-2 w-[28%]">
                    {t("busStations.dateRange")}
                  </TableHead>
                  <TableHead className="p-2 w-[20%] whitespace-nowrap">
                    {t("busStations.revenue")} ({t("busStations.passengers")})
                  </TableHead>
                  <TableHead className="p-2 w-[13%]">
                    {t("busStations.cargo")}
                  </TableHead>
                  <TableHead className="p-2 w-[16%] text-right">
                    {t("busStations.total")}
                  </TableHead>
                  <TableHead className="p-1 w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="p-2 align-middle">
                      {vehicleSelect(row)}
                    </TableCell>
                    <TableCell className="p-2 align-middle">
                      {/* Wraps to two stacked full-width dates when narrow. */}
                      <div className="flex flex-wrap items-center gap-1 min-w-0">
                        <Input
                          type="date"
                          className="min-w-[105px] flex-1 px-1.5"
                          value={row.start_date}
                          onChange={(e) =>
                            updateRow(row.key, { start_date: e.target.value })
                          }
                        />
                        <Input
                          type="date"
                          className="min-w-[105px] flex-1 px-1.5"
                          value={row.end_date}
                          onChange={(e) =>
                            updateRow(row.key, { end_date: e.target.value })
                          }
                        />
                      </div>
                    </TableCell>
                    <TableCell className="p-2 align-middle">
                      {/* Passenger COUNT only — the Kwanza figure is derived. */}
                      <div className="grid gap-0.5 justify-items-start">
                        {passengerInput(row)}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          = {formatCurrency(passengerRevenue(row.passenger_count))}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-2 align-middle">{cargoInput(row)}</TableCell>
                    <TableCell className="p-2 align-middle text-right font-medium whitespace-nowrap">
                      {formatCurrency(rowTotal(row))}
                    </TableCell>
                    <TableCell className="p-1 align-middle">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.key)}
                        disabled={rows.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="p-2" colSpan={2}>
                    {t("busStations.total")}
                  </TableCell>
                  <TableCell className="p-2 whitespace-nowrap">
                    {formatCurrency(totals.passengerRevenue)}
                  </TableCell>
                  <TableCell className="p-2 whitespace-nowrap">
                    {formatCurrency(totals.cargoRevenue)}
                  </TableCell>
                  <TableCell className="p-2 text-right font-bold whitespace-nowrap">
                    {formatCurrency(totals.total)}
                  </TableCell>
                  <TableCell className="p-1" />
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Mobile: one labeled card per row, then the same black totals bar. */}
          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <div key={row.key} className="rounded-md border p-3 space-y-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t("busStations.vehicle")}
                  </Label>
                  {vehicleSelect(row)}
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t("busStations.dateRange")}
                  </Label>
                  <div className="flex items-center gap-1 min-w-0">
                    <Input
                      type="date"
                      className="min-w-0 flex-1 px-1.5"
                      value={row.start_date}
                      onChange={(e) => updateRow(row.key, { start_date: e.target.value })}
                    />
                    <span className="text-muted-foreground shrink-0">–</span>
                    <Input
                      type="date"
                      className="min-w-0 flex-1 px-1.5"
                      value={row.end_date}
                      onChange={(e) => updateRow(row.key, { end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {t("busStations.passengers")}
                    </Label>
                    {passengerInput(row)}
                    <span className="text-xs text-muted-foreground">
                      = {formatCurrency(passengerRevenue(row.passenger_count))}
                    </span>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {t("busStations.cargo")}
                    </Label>
                    {cargoInput(row)}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-sm text-muted-foreground">
                    {t("busStations.total")}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{formatCurrency(rowTotal(row))}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.key)}
                      disabled={rows.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-md bg-primary text-primary-foreground p-3 text-sm space-y-1">
              <div className="flex justify-between gap-4">
                <span>{t("busStations.passengers")}</span>
                <span>{formatCurrency(totals.passengerRevenue)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>{t("busStations.cargo")}</span>
                <span>{formatCurrency(totals.cargoRevenue)}</span>
              </div>
              <div className="flex justify-between gap-4 font-bold">
                <span>{t("busStations.total")}</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* Outside the table so it never sits on the dark footer. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRows((p) => [...p, blankRow()])}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("busStations.addRow")}
          </Button>
        </div>

        {/* Bank slips: one plain upload field, like the expense dialog's
            "Upload Receipt". No amount, no date — and a slip is REQUIRED. */}
        <div className="grid gap-2">
          <Label className="font-medium">{t("busStations.bankSlips")}</Label>
          <Input
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="w-full"
            onChange={(e) => setSlipFiles(Array.from(e.target.files || []))}
          />
          {existingSlips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {existingSlips.map((slip) => (
                <div
                  key={slip.id}
                  className="flex items-center gap-1 rounded-md border px-1"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openStoredFile(slip.slip_url)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {slip.file_name || t("busStations.viewSlip")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExistingSlip(slip)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
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
