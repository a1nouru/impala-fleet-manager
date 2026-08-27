"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Loader2, Bus } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { subDays, format } from "date-fns";
import { financialService } from "@/services/financialService";
import { busStationService } from "@/services/busStationService";
import { toast } from "@/components/ui/use-toast";
import { RecentDeposits } from "@/components/recent-deposits";
import { OverviewChart } from "@/components/overview-chart";
import { useTranslation } from "@/hooks/useTranslation";

// Helper to format currency
const formatCurrency = (value: number) => {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "AOA",
  });
};

export default function AnalyticsPage() {
  const { t } = useTranslation('financials');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const [summary, setSummary] = useState<{
    total_revenue: number;
    total_expenses: number;
    net_balance: number;
  } | null>(null);

  // Bus station takings live outside daily_reports, so they are fetched
  // separately and folded into the displayed totals here rather than inside
  // the shared get_financial_summary RPC.
  const [busStationRevenue, setBusStationRevenue] = useState(0);

  // Company overheads live in company_expenses, outside the summary RPC.
  const [companyExpenses, setCompanyExpenses] = useState(0);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!dateRange || !dateRange.from || !dateRange.to) return;

      try {
        setIsLoading(true);
        const from = format(dateRange.from, "yyyy-MM-dd");
        const to = format(dateRange.to, "yyyy-MM-dd");

        const [summaryData, stationRevenue, companyTotal] = await Promise.all([
          financialService.getFinancialSummary(from, to),
          busStationService.getBusStationRevenueTotal(from, to),
          financialService.getCompanyExpensesTotal(from, to),
        ]);

        setSummary(summaryData);
        setBusStationRevenue(stationRevenue);
        setCompanyExpenses(companyTotal);
      } catch (error) {
        toast({
          title: "Error",
          description: t("analytics.failedToLoadAnalytics"),
          variant: "destructive",
        });
        setSummary(null);
        setBusStationRevenue(0);
        setCompanyExpenses(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [dateRange]);
  
  const renderSummaryCard = (
    title: string,
    value: number | undefined,
    Icon: React.ElementType,
    sub?: React.ReactNode
  ) => (
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
            <div className="text-2xl font-bold">{formatCurrency(value || 0)}</div>
            {sub ?? (
              <p className="text-xs text-muted-foreground">
                {t("analytics.forSelectedPeriod")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t("analytics.title")}</h2>
        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {renderSummaryCard(
          t("analytics.totalRevenue"),
          (summary?.total_revenue || 0) + busStationRevenue,
          DollarSign
        )}
        {renderSummaryCard(t("busStations.title"), busStationRevenue, Bus)}
        {renderSummaryCard(
          t("analytics.totalExpenses"),
          (summary?.total_expenses || 0) + companyExpenses,
          TrendingDown,
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <div className="flex justify-between gap-2">
              <span>{t("analytics.operatingExpenses")}</span>
              <span>{formatCurrency(summary?.total_expenses || 0)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>{t("analytics.generalAdminExpenses")}</span>
              <span>{formatCurrency(companyExpenses)}</span>
            </div>
          </div>
        )}
        {renderSummaryCard(
          t("analytics.netBalance"),
          (summary?.net_balance || 0) + busStationRevenue - companyExpenses,
          TrendingUp
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>{t("analytics.overview")}</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <OverviewChart dateRange={dateRange} />
          </CardContent>
        </Card>
        <RecentDeposits />
      </div>
    </div>
  );
}