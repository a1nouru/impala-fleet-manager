"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { subDays, format } from "date-fns";
import { financialService } from "@/services/financialService";
import { toast } from "@/components/ui/use-toast";
import { AgasekeReport } from "@/components/agaseke-report";
import { RecentDeposits } from "@/components/recent-deposits";
import { OverviewChart } from "@/components/overview-chart";

// Helper to format currency
const formatCurrency = (value: number) => {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "AOA",
  });
};

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const [summary, setSummary] = useState<{
    total_revenue: number;
    total_expenses: number;
    net_balance: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!dateRange || !dateRange.from || !dateRange.to) return;

      try {
        setIsLoading(true);
        const summaryData = await financialService.getFinancialSummary(
          format(dateRange.from, "yyyy-MM-dd"),
          format(dateRange.to, "yyyy-MM-dd")
        );
        
        setSummary(summaryData);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load financial analytics.",
          variant: "destructive",
        });
        setSummary(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [dateRange]);
  
  const renderSummaryCard = (title: string, value: number | undefined, Icon: React.ElementType) => (
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
            <p className="text-xs text-muted-foreground">
              For the selected period
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Financial Analytics</h2>
        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {renderSummaryCard("Total Revenue", summary?.total_revenue, DollarSign)}
        {renderSummaryCard("Total Expenses", summary?.total_expenses, TrendingDown)}
        {renderSummaryCard("Net Balance", summary?.net_balance, TrendingUp)}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <OverviewChart dateRange={dateRange} />
          </CardContent>
        </Card>
        <RecentDeposits />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AgasekeReport dateRange={dateRange} />
      </div>
    </div>
  );
} 