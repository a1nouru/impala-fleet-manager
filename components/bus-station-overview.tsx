"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Building2, Loader2 } from "lucide-react";
import { BUS_STATIONS } from "@/lib/bus-stations/stations";
import type { BusStationOverview } from "@/services/busStationService";
import { useTranslation } from "@/hooks/useTranslation";

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "AOA" });

interface PanelProps {
  title: string;
  value: number;
  sub: string;
  Icon: React.ElementType;
  isLoading: boolean;
  tone?: "default" | "positive" | "negative";
}

function Panel({ title, value, sub, Icon, isLoading, tone = "default" }: PanelProps) {
  const toneClass =
    tone === "negative"
      ? "text-2xl font-bold text-red-600"
      : tone === "positive"
      ? "text-2xl font-bold text-green-600"
      : "text-2xl font-bold";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <>
            <div className={toneClass}>{formatCurrency(value)}</div>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function BusStationOverviewPanels({
  overview,
  isLoading,
}: {
  overview: BusStationOverview | null;
  isLoading: boolean;
}) {
  const { t } = useTranslation("financials");
  const o = overview;

  // The headline figure is NET: gross takings minus park expenses.
  const breakdown =
    (o?.expenses || 0) > 0
      ? `${t("busStations.revenue")} ${formatCurrency(o?.total || 0)} · ${t(
          "busStations.expensesTitle"
        )} − ${formatCurrency(o?.expenses || 0)}`
      : `${t("busStations.passengers")} ${formatCurrency(
          o?.passenger || 0
        )} · ${t("busStations.cargo")} ${formatCurrency(o?.cargo || 0)}`;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Panel
        title={t("busStations.totalRevenue")}
        value={o?.net || 0}
        sub={breakdown}
        Icon={DollarSign}
        isLoading={isLoading}
      />
      {BUS_STATIONS.map((station) => (
        <Panel
          key={station.id}
          title={station.label}
          value={o?.byStation?.[station.id] || 0}
          sub={t("busStations.forSelectedPeriod")}
          Icon={Building2}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
