"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  ComposedChart
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  PieChart as PieChartIcon,
  BarChart3,
  Activity,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Route
} from "lucide-react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { financialService } from "@/services/financialService";
import { toast } from "@/components/ui/use-toast";
import { corridorOf } from "@/lib/fuel/consumption";
import { routePerformance, type RouteReport } from "@/lib/financials/route-performance";

interface OverviewChartProps {
  dateRange: DateRange | undefined;
}

// Color palette for consistent theming
const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  accent: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  teal: '#06b6d4',
  pink: '#ec4899',
  orange: '#f97316'
};

const CHART_COLORS = [
  COLORS.primary,
  COLORS.secondary, 
  COLORS.accent,
  COLORS.danger,
  COLORS.purple,
  COLORS.teal,
  COLORS.pink,
  COLORS.orange
];

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-800 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {`${entry.name}: ${formatter ? formatter(entry.value) : entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Format currency for Angola Kwanza
const formatCurrency = (value: number) => {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "AOA",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

// Format percentage
const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

export function OverviewChart({ dateRange }: OverviewChartProps) {
  const [activeTab, setActiveTab] = useState("revenue-trend");
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Data states
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
  const [vehiclePerformance, setVehiclePerformance] = useState<any[]>([]);
  const [revenueComposition, setRevenueComposition] = useState<any[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<any[]>([]);
  const [kpiMetrics, setKpiMetrics] = useState<any>({});
  const [routeReports, setRouteReports] = useState<RouteReport[]>([]);
  const [corridor, setCorridor] = useState("");

  // Handle client-side mounting
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch all chart data
  useEffect(() => {
    const fetchChartData = async () => {
      if (!dateRange?.from || !dateRange?.to) return;

      try {
        setIsLoading(true);
        const startDate = format(dateRange.from, "yyyy-MM-dd");
        const endDate = format(dateRange.to, "yyyy-MM-dd");
        const currentYear = new Date().getFullYear();

        const [
          trendData,
          expenseData,
          vehicleData,
          compositionData,
          comparisonData,
          kpiData,
          rangeReports
        ] = await Promise.all([
          financialService.getRevenueTrend(startDate, endDate),
          financialService.getExpenseBreakdown(startDate, endDate),
          financialService.getVehiclePerformance(startDate, endDate),
          financialService.getRevenueComposition(startDate, endDate),
          financialService.getMonthlyComparison(currentYear),
          financialService.getKPIMetrics(startDate, endDate),
          financialService.getDailyReportsInRange(startDate, endDate)
        ]);

        setRevenueTrend(trendData);
        setExpenseBreakdown(expenseData);
        setVehiclePerformance(vehicleData);
        setRevenueComposition(compositionData);
        setMonthlyComparison(comparisonData);
        setKpiMetrics(kpiData);
        setRouteReports(rangeReports.map((r) => ({
          plate: r.vehicles?.plate || "Unknown",
          corridor: r.route?.trim() ? corridorOf(r.route).corridor : null,
          ticket: Number(r.ticket_revenue) || 0,
          baggage: Number(r.baggage_revenue) || 0,
          cargo: Number(r.cargo_revenue) || 0,
          expenses: (r.daily_expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
        })));

      } catch (error) {
        console.error('Error fetching chart data:', error);
        toast({
          title: "Error",
          description: "Failed to load chart data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchChartData();
  }, [dateRange]);

  const routes = useMemo(() => routePerformance(routeReports), [routeReports]);
  const currentRoute = routes.find((r) => r.corridor === corridor) ?? routes[0];

  // Don't render until mounted on client
  if (!isMounted) {
    return (
      <div className="h-[600px] w-full flex items-center justify-center">
        <div className="animate-pulse">Loading charts...</div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-[600px] w-full flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Financial Overview
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {dateRange?.from && dateRange?.to ? 
                `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}` : 
                "Select date range"
              }
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="revenue-trend" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Trends</span>
            </TabsTrigger>
            <TabsTrigger value="expense-breakdown" className="flex items-center gap-1">
              <PieChartIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Expenses</span>
            </TabsTrigger>
            <TabsTrigger value="vehicle-performance" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Vehicles</span>
            </TabsTrigger>
            <TabsTrigger value="routes" className="flex items-center gap-1">
              <Route className="h-4 w-4" />
              <span className="hidden sm:inline">Routes</span>
            </TabsTrigger>
            <TabsTrigger value="revenue-composition" className="flex items-center gap-1">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Revenue</span>
            </TabsTrigger>
            <TabsTrigger value="comparison" className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Compare</span>
            </TabsTrigger>
          </TabsList>

          {/* Revenue Trend Chart */}
          <TabsContent value="revenue-trend" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Revenue & Expense Trends</h3>
              <div className="flex gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                  Net Growth: {formatPercentage(kpiMetrics.revenue_growth || 0)}
                </Badge>
              </div>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueTrend} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    fill={COLORS.primary}
                    fillOpacity={0.1}
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    name="Revenue"
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke={COLORS.danger}
                    strokeWidth={2}
                    name="Expenses"
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke={COLORS.secondary}
                    strokeWidth={3}
                    name="Net Profit"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Expense Breakdown Chart */}
          <TabsContent value="expense-breakdown" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Expense Categories</h3>
              <Badge variant="outline">
                Total: {formatCurrency(kpiMetrics.total_expenses || 0)}
              </Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-gray-600">Category Breakdown</h4>
                {expenseBreakdown.map((category, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium text-sm">{category.category}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{formatCurrency(category.amount)}</div>
                      <div className="text-xs text-gray-500">{category.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Vehicle Performance Chart */}
          <TabsContent value="vehicle-performance" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Vehicle Performance Comparison</h3>
              <Badge variant="outline">
                Best: {kpiMetrics.best_performing_vehicle || 'N/A'}
              </Badge>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vehiclePerformance} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="vehicle_plate" 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                  <Legend />
                  <Bar dataKey="total_revenue" fill={COLORS.primary} name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_expenses" fill={COLORS.danger} name="Expenses" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net_profit" fill={COLORS.secondary} name="Net Profit" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Route Comparison: vehicles on one corridor, revenue split by type */}
          <TabsContent value="routes" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-lg font-medium">Route Performance</h3>
              {routes.length > 0 && (
                <Select value={currentRoute?.corridor} onValueChange={setCorridor}>
                  <SelectTrigger className="w-full sm:w-[260px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {routes.map((r) => (
                      <SelectItem key={r.corridor} value={r.corridor}>{r.corridor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {!currentRoute ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-500">
                No trips with a route in the selected period.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Revenue", value: formatCurrency(currentRoute.total.revenue), sub: `${currentRoute.total.trips} trips · ${formatCurrency(currentRoute.total.revenuePerTrip)} / trip` },
                    { label: "Expenses", value: formatCurrency(currentRoute.total.expenses), sub: `${currentRoute.vehicles.length} vehicles` },
                    { label: "Net Profit", value: formatCurrency(currentRoute.total.net), sub: `Margin ${formatPercentage(currentRoute.total.revenue ? (currentRoute.total.net / currentRoute.total.revenue) * 100 : 0)}` },
                    {
                      label: "Revenue Breakdown",
                      value: formatPercentage(currentRoute.total.revenue ? (currentRoute.total.ticket / currentRoute.total.revenue) * 100 : 0) + " tickets",
                      sub: `Baggage ${formatCurrency(currentRoute.total.baggage)} · Cargo ${formatCurrency(currentRoute.total.cargo)}`,
                    },
                  ].map((s) => (
                    <div key={s.label} className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500">{s.label}</div>
                      <div className="font-semibold">{s.value}</div>
                      <div className="text-xs text-gray-500">{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentRoute.vehicles} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={60} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatCurrency} />
                      <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                      <Legend verticalAlign="top" />
                      <Bar dataKey="ticket" stackId="revenue" fill={COLORS.primary} name="Ticket" />
                      <Bar dataKey="baggage" stackId="revenue" fill={COLORS.teal} name="Baggage" />
                      <Bar dataKey="cargo" stackId="revenue" fill={COLORS.accent} name="Cargo" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" fill={COLORS.danger} name="Expenses" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="net" fill={COLORS.secondary} name="Net Profit" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="border-b text-gray-600">
                        <th className="px-3 py-2 text-left font-medium">Vehicle</th>
                        <th className="px-3 py-2 text-right font-medium">Trips</th>
                        <th className="px-3 py-2 text-right font-medium">Ticket</th>
                        <th className="px-3 py-2 text-right font-medium">Baggage</th>
                        <th className="px-3 py-2 text-right font-medium">Cargo</th>
                        <th className="px-3 py-2 text-right font-medium">Revenue</th>
                        <th className="px-3 py-2 text-right font-medium">Revenue / Trip</th>
                        <th className="px-3 py-2 text-right font-medium">Expenses</th>
                        <th className="px-3 py-2 text-right font-medium">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...currentRoute.vehicles, { ...currentRoute.total, name: "Total" }].map((v) => (
                        <tr key={v.name} className={`border-b ${v.name === "Total" ? "font-semibold bg-gray-50" : "hover:bg-gray-50"}`}>
                          <td className="px-3 py-2">{v.name}</td>
                          <td className="px-3 py-2 text-right">{v.trips}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(v.ticket)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(v.baggage)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(v.cargo)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(v.revenue)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(v.revenuePerTrip)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(v.expenses)}</td>
                          <td className={`px-3 py-2 text-right ${v.net < 0 ? "text-red-600" : ""}`}>{formatCurrency(v.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </TabsContent>

          {/* Revenue Composition Chart */}
          <TabsContent value="revenue-composition" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Revenue Composition Over Time</h3>
              <Badge variant="outline">
                Avg Daily: {formatCurrency(kpiMetrics.avg_daily_revenue || 0)}
              </Badge>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueComposition} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="ticket_revenue"
                    stackId="1"
                    stroke={COLORS.primary}
                    fill={COLORS.primary}
                    name="Ticket Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="baggage_revenue"
                    stackId="1"
                    stroke={COLORS.secondary}
                    fill={COLORS.secondary}
                    name="Baggage Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="cargo_revenue"
                    stackId="1"
                    stroke={COLORS.accent}
                    fill={COLORS.accent}
                    name="Cargo Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Monthly Comparison Chart */}
          <TabsContent value="comparison" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Year-over-Year Comparison</h3>
              <Badge variant="outline">
                Profit Margin: {formatPercentage(kpiMetrics.profit_margin || 0)}
              </Badge>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyComparison} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                  <Legend />
                  <Bar dataKey="current_year_revenue" fill={COLORS.primary} name="Current Year" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previous_year_revenue" fill={COLORS.secondary} name="Previous Year" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 