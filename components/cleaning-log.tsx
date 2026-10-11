"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Bug, Sparkles, AlertTriangle, CreditCard, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { vehicleService } from "@/services/vehicleService";
import { cleaningService, type CleaningLog } from "@/services/cleaningService";
import {
  CLEANING_INTERVAL_DAYS,
  cleaningStatus,
  daysSince,
  lastDateByVehicle,
  type CleaningStatus,
  type CleaningType,
} from "@/lib/cleaning/status";

interface Vehicle {
  id: string;
  plate: string;
}

const todayISO = () => format(new Date(), "yyyy-MM-dd");

const emptyForm = () => ({
  vehicle_id: "",
  cleaning_date: todayISO(),
  location: "",
  performed_by: "",
  product: "",
  cost: "",
  notes: "",
});

export default function CleaningLog() {
  const { t } = useTranslation("maintenance");
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogType, setDialogType] = useState<CleaningType | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [toDelete, setToDelete] = useState<CleaningLog | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | CleaningType>("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");

  const load = async () => {
    try {
      const [logData, vehicleData] = await Promise.all([cleaningService.getLogs(), vehicleService.getVehicles()]);
      setLogs(logData);
      setVehicles(vehicleData || []);
    } catch (error: any) {
      toast({ title: t("cleaning.loadError"), description: error?.message ?? "", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plateById = useMemo(() => new Map(vehicles.map((v) => [v.id, v.plate])), [vehicles]);
  const today = todayISO();
  const monthPrefix = today.slice(0, 7);

  const stats = useMemo(() => {
    const thisMonth = logs.filter((l) => l.cleaning_date.startsWith(monthPrefix));
    return {
      deepCleans: thisMonth.filter((l) => l.type === "deep_clean").length,
      insecticides: thisMonth.filter((l) => l.type === "insecticide").length,
      cost: thisMonth.reduce((sum, l) => sum + Number(l.cost || 0), 0),
    };
  }, [logs, monthPrefix]);

  const vehicleStatus = useMemo(() => {
    const lastDeep = lastDateByVehicle(logs, "deep_clean");
    const lastInsect = lastDateByVehicle(logs, "insecticide");
    return vehicles
      .map((v) => {
        const deep = lastDeep.get(v.id);
        const insect = lastInsect.get(v.id);
        return {
          vehicle: v,
          deep,
          insect,
          deepStatus: cleaningStatus(deep, "deep_clean", today),
          insectStatus: cleaningStatus(insect, "insecticide", today),
        };
      })
      .sort((a, b) => a.vehicle.plate.localeCompare(b.vehicle.plate));
  }, [logs, vehicles, today]);

  const needsAttention = vehicleStatus.filter((s) => s.deepStatus !== "ok" || s.insectStatus !== "ok").length;

  const filteredLogs = logs.filter(
    (l) => (typeFilter === "all" || l.type === typeFilter) && (vehicleFilter === "all" || l.vehicle_id === vehicleFilter)
  );

  const openDialog = (type: CleaningType) => {
    setForm(emptyForm());
    setDialogType(type);
  };

  const handleSave = async () => {
    if (!dialogType) return;
    if (!form.vehicle_id || !form.cleaning_date || !form.location.trim()) {
      toast({ title: t("cleaning.validationTitle"), description: t("cleaning.requiredFields"), variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const created = await cleaningService.createLog({
        vehicle_id: form.vehicle_id,
        type: dialogType,
        cleaning_date: form.cleaning_date,
        location: form.location.trim(),
        performed_by: form.performed_by.trim() || null,
        product: dialogType === "insecticide" ? form.product.trim() || null : null,
        cost: form.cost === "" ? null : Number(form.cost),
        notes: form.notes.trim() || null,
      });
      setLogs((prev) => [created, ...prev].sort((a, b) => b.cleaning_date.localeCompare(a.cleaning_date)));
      setDialogType(null);
      toast({ title: t("cleaning.savedTitle"), description: t("cleaning.saved") });
    } catch (error: any) {
      toast({ title: t("cleaning.saveError"), description: error?.message ?? "", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await cleaningService.deleteLog(toDelete.id);
      setLogs((prev) => prev.filter((l) => l.id !== toDelete.id));
      toast({ title: t("cleaning.deletedTitle"), description: t("cleaning.deleted") });
    } catch (error: any) {
      toast({ title: t("cleaning.saveError"), description: error?.message ?? "", variant: "destructive" });
    } finally {
      setToDelete(null);
    }
  };

  const typeBadge = (type: CleaningType) =>
    type === "deep_clean" ? (
      <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 border-transparent">{t("cleaning.deepClean")}</Badge>
    ) : (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-transparent">{t("cleaning.insecticide")}</Badge>
    );

  const statusCell = (date: string | undefined, status: CleaningStatus) => {
    if (status === "never") return <Badge variant="destructive">{t("cleaning.never")}</Badge>;
    const days = daysSince(date!, today);
    return (
      <div className="flex items-center gap-2">
        <span>{format(parseISO(date!), "dd/MM/yyyy")}</span>
        <Badge
          className={
            status === "overdue"
              ? "bg-red-100 text-red-800 hover:bg-red-100 border-transparent"
              : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-transparent"
          }
        >
          {t("cleaning.daysAgo", { count: days })}
        </Badge>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg md:text-xl font-semibold text-gray-800">{t("cleaning.title")}</h2>
        <div className="flex gap-2">
          <Button onClick={() => openDialog("deep_clean")} className="bg-black hover:bg-gray-800 text-white">
            <Sparkles className="mr-2 h-4 w-4" />
            {t("cleaning.logDeepClean")}
          </Button>
          <Button onClick={() => openDialog("insecticide")} variant="outline">
            <Bug className="mr-2 h-4 w-4" />
            {t("cleaning.logInsecticide")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("cleaning.deepCleansThisMonth")}</CardTitle>
            <Sparkles className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stats.deepCleans}</div>
            <p className="text-xs text-muted-foreground">{t("cleaning.everyNDays", { count: CLEANING_INTERVAL_DAYS.deep_clean })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("cleaning.insecticidesThisMonth")}</CardTitle>
            <Bug className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stats.insecticides}</div>
            <p className="text-xs text-muted-foreground">{t("cleaning.everyNDays", { count: CLEANING_INTERVAL_DAYS.insecticide })}</p>
          </CardContent>
        </Card>
        <Card className={needsAttention > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("cleaning.needsAttention")}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">
              {needsAttention} / {vehicles.length}
            </div>
            <p className="text-xs text-muted-foreground">{t("cleaning.needsAttentionSub")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("cleaning.costThisMonth")}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stats.cost.toLocaleString()} Kz</div>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleString("default", { month: "long" })} {new Date().getFullYear()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("cleaning.vehicleStatus")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("form.vehicle")}</TableHead>
                <TableHead>{t("cleaning.lastDeepClean")}</TableHead>
                <TableHead>{t("cleaning.lastInsecticide")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicleStatus.map((s) => (
                <TableRow key={s.vehicle.id}>
                  <TableCell className="font-medium">{s.vehicle.plate}</TableCell>
                  <TableCell>{statusCell(s.deep, s.deepStatus)}</TableCell>
                  <TableCell>{statusCell(s.insect, s.insectStatus)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">{t("cleaning.history")}</CardTitle>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("cleaning.allTypes")}</SelectItem>
                <SelectItem value="deep_clean">{t("cleaning.deepClean")}</SelectItem>
                <SelectItem value="insecticide">{t("cleaning.insecticide")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("cleaning.allVehicles")}</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.plate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("cleaning.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("form.date")}</TableHead>
                  <TableHead>{t("form.vehicle")}</TableHead>
                  <TableHead>{t("cleaning.type")}</TableHead>
                  <TableHead>{t("cleaning.location")}</TableHead>
                  <TableHead>{t("cleaning.performedBy")}</TableHead>
                  <TableHead>{t("cleaning.product")}</TableHead>
                  <TableHead className="text-right">{t("cleaning.cost")}</TableHead>
                  <TableHead>{t("cleaning.notes")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">{format(parseISO(l.cleaning_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{plateById.get(l.vehicle_id) ?? "—"}</TableCell>
                    <TableCell>{typeBadge(l.type)}</TableCell>
                    <TableCell>{l.location}</TableCell>
                    <TableCell>{l.performed_by ?? "—"}</TableCell>
                    <TableCell>{l.product ?? "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {l.cost != null ? `${Number(l.cost).toLocaleString()} Kz` : "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate" title={l.notes ?? ""}>
                      {l.notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setToDelete(l)} aria-label={t("cleaning.delete")}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogType !== null} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogType === "insecticide" ? t("cleaning.logInsecticide") : t("cleaning.logDeepClean")}</DialogTitle>
            <DialogDescription>{t("cleaning.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>
                {t("form.vehicle")} <span className="text-red-500">*</span>
              </Label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("form.selectVehicle")} />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>
                  {t("form.date")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  max={today}
                  value={form.cleaning_date}
                  onChange={(e) => setForm({ ...form, cleaning_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("cleaning.cost")} (Kz)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>
                {t("cleaning.location")} <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder={t("cleaning.locationPlaceholder")}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("cleaning.performedBy")}</Label>
              <Input
                placeholder={t("cleaning.performedByPlaceholder")}
                value={form.performed_by}
                onChange={(e) => setForm({ ...form, performed_by: e.target.value })}
              />
            </div>
            {dialogType === "insecticide" && (
              <div className="grid gap-2">
                <Label>{t("cleaning.product")}</Label>
                <Input
                  placeholder={t("cleaning.productPlaceholder")}
                  value={form.product}
                  onChange={(e) => setForm({ ...form, product: e.target.value })}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label>{t("cleaning.notes")}</Label>
              <Textarea
                rows={3}
                placeholder={t("cleaning.notesPlaceholder")}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)} disabled={isSaving}>
              {t("form.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-black hover:bg-gray-800 text-white">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("form.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cleaning.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cleaning.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("form.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t("cleaning.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
