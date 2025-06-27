"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Calendar,
  DownloadIcon, 
  BarChart,
  PieChart,
  LineChart,
  BarChart3,
  DollarSign,
  Wrench,
  TrendingUp,
  Info,
  Loader2,
  CreditCard
} from "lucide-react"
import { 
  BarChart as RechartsBarChart,
  LineChart as RechartsLineChart,
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  Line, 
  Bar, 
  ResponsiveContainer,
  Cell,
  PieChart as RechartsPieChart,
  Pie
} from "recharts"
import { maintenanceService } from "@/services/maintenanceService"
import { vehicleService } from "@/services/vehicleService"
import { format } from "date-fns"
import { toast } from "@/components/ui/use-toast"
import { useTranslation } from "@/hooks/useTranslation"

// Type definitions
interface Vehicle {
  id: string;
  plate: string;
  model: string;
}

interface MaintenanceRecord {
  id: string;
  date: string;
  description: string;
  status: string;
  cost: number;
  kilometers?: number;
  vehicle_id?: string;
  technician_id?: string;
  vehiclePlate?: string;
  technician?: string;
  parts?: string[];
  created_by?: string;
  vehicles?: {
    plate: string;
    model: string;
  };
  technicians?: {
    name: string;
  };
}

interface Part {
  id: string;
  name: string;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#4D4D4D', '#E6194B', '#3CB44B', '#FFE119', '#4363D8'
];

export default function ReportsPage() {
  // State for data
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  
  // UI state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  // Filters
  const [selectedVehicle, setSelectedVehicle] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), 0, 1), // Start of current year
    to: new Date(),
  });
  const [activeMetric, setActiveMetric] = useState<"cost" | "frequency">("cost");
  
  // Tab state - this replaces the activeTab variable that was causing the error
  const [activeTab, setActiveTab] = useState("monthly");
  
  // UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  
  // Loading states
  const [isLoading, setIsLoading] = useState({
    records: true,
    vehicles: true,
    parts: true,
  });

  // Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedVehicle, dateRange, activeMetric]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch maintenance records
        const maintenanceData = await maintenanceService.getMaintenanceRecords();
        setRecords(maintenanceData);
        setIsLoading(prev => ({ ...prev, records: false }));
        
        // Fetch vehicles
        const vehicleData = await vehicleService.getVehicles();
        setVehicles(vehicleData);
        setIsLoading(prev => ({ ...prev, vehicles: false }));
        
        // Extract parts from maintenance records to get all unique parts
        const uniqueParts = new Set<string>();
        maintenanceData.forEach(record => {
          if (record.parts && Array.isArray(record.parts)) {
            record.parts.forEach((part: string) => uniqueParts.add(part));
          }
        });
        
        setParts(Array.from(uniqueParts).map(name => ({ id: name, name })));
        setIsLoading(prev => ({ ...prev, parts: false }));
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load report data. Please try refreshing the page.",
          variant: "destructive"
        });
      }
    };
    
    fetchData();
  }, []);

  // Filter records based on selected vehicle and date range
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // Filter by vehicle if selected
      if (selectedVehicle !== "all") {
        const vehiclePlate = record.vehicles?.plate || record.vehiclePlate;
        if (vehiclePlate !== selectedVehicle) {
          return false;
        }
      }
      
      // Filter by date range if specified
      if (record.date) {
        const recordDate = new Date(record.date);
        
        // Normalize record date to remove time component
        recordDate.setHours(0, 0, 0, 0);
        
        // Check if date is within range
        if (dateRange.from) {
          const fromDate = new Date(dateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          if (recordDate < fromDate) {
            return false;
          }
        }
        
        if (dateRange.to) {
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999); // End of day
          if (recordDate > toDate) {
            return false;
          }
        }
      }
      
      return true;
    });
  }, [records, selectedVehicle, dateRange]);

  // Calculate monthly data for line chart
  const monthlyData = useMemo(() => {
    const monthlyTotals: Record<string, number> = {};
    
    // First, collect all months that have records from the filtered data
    filteredRecords.forEach(record => {
      const recordDate = new Date(record.date);
      const monthKey = format(recordDate, 'MMM yyyy');
      
      if (monthlyTotals[monthKey] === undefined) {
        monthlyTotals[monthKey] = 0;
      }
      
      monthlyTotals[monthKey] += record.cost || 0;
    });
    
    // If the date range is set, ensure all months in the range are initialized (even with zero values)
    if (dateRange.from && dateRange.to) {
      let currentDate = new Date(dateRange.from);
      while (currentDate <= dateRange.to) {
        const monthKey = format(currentDate, 'MMM yyyy');
        if (monthlyTotals[monthKey] === undefined) {
          monthlyTotals[monthKey] = 0;
        }
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      }
    }
    
    // Convert to array for Recharts and sort by date
    return Object.entries(monthlyTotals)
      .map(([name, value]) => ({
        name,
        value: Math.round(value * 100) / 100, // Round to 2 decimal places
        // Store the date to allow sorting
        sortDate: new Date(name)
      }))
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
      .map(({name, value}) => ({name, value})); // Remove the sortDate field
  }, [filteredRecords, dateRange]);

  // Calculate per-vehicle costs
  const vehicleCostData = useMemo(() => {
    const vehicleCosts: Record<string, number> = {};
    
    // Sum costs by vehicle for all filtered records
    filteredRecords.forEach(record => {
      const vehiclePlate = record.vehicles?.plate || record.vehiclePlate || 'Unknown';
      
      if (!vehicleCosts[vehiclePlate]) {
        vehicleCosts[vehiclePlate] = 0;
      }
      
      vehicleCosts[vehiclePlate] += record.cost || 0;
    });
    
    // Convert to array and sort by cost (descending)
    return Object.entries(vehicleCosts)
      .map(([name, value]) => ({
        name,
        value: Math.round(value * 100) / 100 // Round to 2 decimal places
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRecords]);

  // Calculate parts usage
  const partsData = useMemo(() => {
    const partsCount: Record<string, number> = {};
    
    // Count part occurrences for all filtered records
    filteredRecords.forEach(record => {
      if (record.parts && Array.isArray(record.parts)) {
        record.parts.forEach(part => {
          if (!partsCount[part]) {
            partsCount[part] = 0;
          }
          partsCount[part] += 1;
        });
      }
    });
    
    // Convert to array, sort by count (descending), and take top 5
    return Object.entries(partsCount)
      .map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredRecords]);

  // Total maintenance cost (filtered)
  const totalCost = useMemo(() => {
    return filteredRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
  }, [filteredRecords]);

  // Total lifetime maintenance cost (all records - matching the maintenance page)
  const totalLifetimeCost = useMemo(() => {
    return records.reduce((sum, record) => sum + (record.cost || 0), 0);
  }, [records]);

  const formatCost = (value: number) => {
    return value.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0
    }) + " Kz";
  };

  const isDataLoading = isLoading.records || isLoading.vehicles || isLoading.parts;

  const exportReportToCSV = () => {
    // Prepare the data
    const header = [
      'Date', 
      'Vehicle', 
      'Description', 
      'Status', 
      'Cost (Kz)', 
      'Technician', 
      'Parts'
    ].join(',');
    
    const rows = filteredRecords.map(record => {
      return [
        record.date,
        record.vehicles?.plate || record.vehiclePlate,
        `"${record.description.replace(/"/g, '""')}"`, // Escape quotes
        record.status,
        record.cost,
        record.technicians?.name || record.technician,
        `"${(record.parts || []).join(', ').replace(/"/g, '""')}"` // Escape quotes
      ].join(',');
    });
    
    const csv = [header, ...rows].join('\n');
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Set up download attributes
    link.setAttribute('href', url);
    link.setAttribute('download', `maintenance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Report Exported",
      description: "Your maintenance report has been downloaded as a CSV file.",
    });
  };

  const { t } = useTranslation("common");

  return (
    <div className="flex-1 p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">{t('reports.title')}</h1>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="h-9 text-sm" 
            onClick={exportReportToCSV}
            disabled={isDataLoading || filteredRecords.length === 0}
          >
            <DownloadIcon className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{t('reports.exportReport')}</span>
            <span className="sm:hidden">{t('buttons.export')}</span>
          </Button>
        </div>
      </div>

      {isDataLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-lg sm:text-xl ml-4">{t('messages.loading')}</span>
        </div>
      ) : (
        <>
          {/* Filters and Controls */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-3 sm:p-4 space-y-4">
              <h2 className="text-base sm:text-lg font-medium">{t('reports.reportFilters')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicleFilter">{t('reports.vehicle')}</Label>
                  <Select
                    value={selectedVehicle}
                    onValueChange={setSelectedVehicle}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('messages.selectVehicle')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('reports.allVehicles')}</SelectItem>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.plate}>
                          {vehicle.plate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dateRange">{t('reports.dateRange')}</Label>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal text-sm"
                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <span className="truncate">
                          {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                        </span>
                      ) : (
                        format(dateRange.from, "MMM d, yyyy")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                  {isCalendarOpen && (
                    <div className="mt-2 p-3 sm:p-4 bg-white border rounded-md shadow-md">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Start Date</Label>
                          <Input 
                            type="date" 
                            value={dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value) : undefined;
                              setDateRange(prev => ({
                                ...prev,
                                from: date
                              }));
                            }}
                          />
                        </div>
                        <div>
                          <Label>End Date</Label>
                          <Input 
                            type="date" 
                            value={dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value) : undefined;
                              setDateRange(prev => ({
                                ...prev,
                                to: date
                              }));
                              if (date) setIsCalendarOpen(false);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="metricType">{t('reports.metricType')}</Label>
                  <Select
                    value={activeMetric}
                    onValueChange={(value) => setActiveMetric(value as "cost" | "frequency")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cost">{t('reports.costAnalysis')}</SelectItem>
                      <SelectItem value="frequency">Frequency Analysis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-indigo-900">
                  {t('reports.totalMaintenanceCost')}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-indigo-900">{formatCost(totalLifetimeCost)}</div>
                <p className="text-xs text-indigo-700">
                  {t('reports.allVehiclesLifetime')}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-emerald-900">
                  {t('reports.filteredCost')}
                </CardTitle>
                <CreditCard className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-emerald-900">
                  {formatCost(totalCost)}
                </div>
                <p className="text-xs text-emerald-700">
                  {selectedVehicle === "all" ? t('reports.allVehicles2') : selectedVehicle}
                  {dateRange.from && (
                    <span className="block mt-1">
                      {format(dateRange.from, "MMM d, yyyy")} - {dateRange.to ? format(dateRange.to, "MMM d, yyyy") : "now"}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-amber-900">
                  {t('reports.maintenanceRecords')}
                </CardTitle>
                <Wrench className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-amber-900">{filteredRecords.length}</div>
                <p className="text-xs text-amber-700">
                  {dateRange.from && dateRange.to ? 
                    `${format(dateRange.from, "MMM yyyy")} - ${format(dateRange.to, "MMM yyyy")}` : 
                    "All time"}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-rose-900">
                  {t('reports.uniquePartsUsed')}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-rose-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-rose-900">{parts.length}</div>
                <p className="text-xs text-rose-700">
                  {t('reports.topUsed')}: {partsData[0]?.name || "N/A"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart Tabs */}
          <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-2 h-auto p-1">
              <TabsTrigger 
                value="monthly" 
                className="px-2 sm:px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-black data-[state=active]:text-white"
              >
                <LineChart className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{t('reports.monthlyTrend')}</span>
                <span className="sm:hidden">Monthly</span>
              </TabsTrigger>
              <TabsTrigger 
                value="vehicles" 
                className="px-2 sm:px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-black data-[state=active]:text-white"
              >
                <BarChart className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{t('reports.vehicleComparison')}</span>
                <span className="sm:hidden">Vehicles</span>
              </TabsTrigger>
              <TabsTrigger 
                value="parts" 
                className="px-2 sm:px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-black data-[state=active]:text-white"
              >
                <PieChart className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{t('reports.partUsage')}</span>
                <span className="sm:hidden">Parts</span>
              </TabsTrigger>
              <TabsTrigger 
                value="details" 
                className="px-2 sm:px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-black data-[state=active]:text-white"
              >
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{t('reports.detailedAnalysis')}</span>
                <span className="sm:hidden">Details</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="monthly" className="pt-4 sm:pt-6">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Monthly Maintenance Cost Trend</CardTitle>
                  <CardDescription className="text-sm">
                    Cost distribution over time for {selectedVehicle === "all" ? "all vehicles" : selectedVehicle}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-0">
                  {monthlyData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Info className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-center text-sm">No maintenance data available for the selected filters.</p>
                    </div>
                  ) : (
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="name"
                            tick={{ fill: '#6B7280' }}
                            tickMargin={10}
                            angle={-45}
                            textAnchor="end"
                          />
                          <YAxis 
                            tick={{ fill: '#6B7280' }}
                            tickFormatter={(value) => `${value.toLocaleString()} Kz`} 
                          />
                          <RechartsTooltip 
                            formatter={(value: number) => [`${value.toLocaleString()} Kz`, 'Maintenance Cost']}
                            labelFormatter={(label) => `Month: ${label}`}
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #d1d5db', borderRadius: '6px' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            name="Cost"
                            stroke="#2563EB" 
                            strokeWidth={2} 
                            dot={{ r: 4, stroke: '#2563EB', fillOpacity: 1, fill: 'white' }}
                            activeDot={{ r: 6, stroke: '#2563EB', strokeWidth: 2, fill: '#2563EB' }}
                            connectNulls={true}
                          />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                      
                      {monthlyData.length === 1 && (
                        <div className="text-center mt-4 text-sm text-muted-foreground">
                          <Info className="h-4 w-4 inline-block mr-1" />
                          Only one month of data is available with the current filters.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="vehicles" className="pt-4 sm:pt-6">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Maintenance Cost by Vehicle</CardTitle>
                  <CardDescription className="text-sm">
                    Comparing maintenance expenses across different vehicles
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-0">
                  {vehicleCostData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Info className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-center text-sm">No vehicle data available for the selected filters.</p>
                    </div>
                  ) : (
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart 
                          data={vehicleCostData} 
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            type="number"
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickFormatter={(value) => `${value.toLocaleString()} Kz`}
                          />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            width={80}
                          />
                          <RechartsTooltip 
                            formatter={(value: number) => [`${value.toLocaleString()} Kz`, 'Maintenance Cost']}
                            labelFormatter={(label) => `Vehicle: ${label}`}
                          />
                          <Bar 
                            dataKey="value" 
                            name="Cost"
                            fill="#2563EB"
                            radius={[0, 4, 4, 0]}
                          />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="parts" className="pt-4 sm:pt-6">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Top 5 Parts Used in Maintenance</CardTitle>
                  <CardDescription className="text-sm">
                    Most frequently replaced or serviced components
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {partsData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Info className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-center text-sm">No parts data available for the selected filters.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="h-64 sm:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={partsData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={window.innerWidth < 640 ? 60 : 80}
                              dataKey="value"
                            >
                              {partsData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value: number) => [`${value} times`, 'Usage Count']} />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="p-2 sm:p-4">
                        <h3 className="text-base sm:text-lg font-medium mb-4">Top Parts Breakdown</h3>
                        <div className="space-y-3">
                          {partsData.map((part, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div 
                                  className="w-3 h-3 mr-2 rounded-full" 
                                  style={{ backgroundColor: part.color }}
                                />
                                <span className="font-medium text-sm">{part.name}</span>
                              </div>
                              <div className="text-sm">
                                <span className="font-semibold">{part.value}</span> times
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="details" className="pt-4 sm:pt-6">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Detailed Maintenance Analysis</CardTitle>
                  <CardDescription className="text-sm">
                    Comprehensive view of maintenance metrics
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Info className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-center text-sm">No data available for the selected filters.</p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile Card View */}
                      <div className="lg:hidden space-y-4 p-4">
                        {filteredRecords.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage).map((record) => (
                          <Card key={record.id} className="border border-gray-200">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium text-sm">
                                  {record.vehicles?.plate || record.vehiclePlate}
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-sm">{formatCost(record.cost)}</div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(record.date).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              <div className="text-sm text-gray-600 mb-2 line-clamp-2">
                                {record.description}
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  record.status === "Completed" 
                                    ? "bg-green-100 text-green-800" 
                                    : record.status === "In Progress"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}>
                                  {record.status}
                                </span>
                                {record.technicians?.name && (
                                  <div className="text-xs text-gray-500">
                                    Tech: {record.technicians.name}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="px-4 py-3 text-left text-sm font-medium">Vehicle</th>
                              <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                              <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                              <th className="px-4 py-3 text-right text-sm font-medium">Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRecords.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage).map((record) => (
                              <tr key={record.id} className="border-b hover:bg-muted/50">
                                <td className="px-4 py-3 text-sm">{record.vehicles?.plate || record.vehiclePlate}</td>
                                <td className="px-4 py-3 text-sm">{new Date(record.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-sm max-w-xs truncate">{record.description}</td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    record.status === "Completed" 
                                      ? "bg-green-100 text-green-800" 
                                      : record.status === "In Progress"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}>
                                    {record.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-right">{record.cost.toLocaleString()} Kz</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {filteredRecords.length > recordsPerPage && (
                          <div className="p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between border-t gap-4">
                            <div className="text-xs sm:text-sm text-muted-foreground">
                              Showing {Math.min((currentPage - 1) * recordsPerPage + 1, filteredRecords.length)} to {Math.min(currentPage * recordsPerPage, filteredRecords.length)} of {filteredRecords.length} records
                            </div>
                            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs sm:text-sm text-muted-foreground">Rows per page:</span>
                                <Select 
                                  value={recordsPerPage.toString()} 
                                  onValueChange={(value) => {
                                    setRecordsPerPage(Number(value));
                                    setCurrentPage(1);
                                  }}
                                >
                                  <SelectTrigger className="h-8 w-[70px]">
                                    <SelectValue placeholder={recordsPerPage.toString()} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setCurrentPage(page => Math.max(page - 1, 1))}
                                  disabled={currentPage === 1}
                                  className="text-xs sm:text-sm"
                                >
                                  <span className="hidden sm:inline">Previous</span>
                                  <span className="sm:hidden">Prev</span>
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setCurrentPage(page => page + 1)}
                                  disabled={currentPage * recordsPerPage >= filteredRecords.length}
                                  className="text-xs sm:text-sm"
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Mobile Pagination */}
                      {filteredRecords.length > recordsPerPage && (
                        <div className="lg:hidden p-4 border-t">
                          <div className="flex flex-col space-y-4">
                            <div className="text-xs text-center text-muted-foreground">
                              Showing {Math.min((currentPage - 1) * recordsPerPage + 1, filteredRecords.length)} to {Math.min(currentPage * recordsPerPage, filteredRecords.length)} of {filteredRecords.length} records
                            </div>
                            <div className="flex justify-center space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setCurrentPage(page => Math.max(page - 1, 1))}
                                disabled={currentPage === 1}
                                className="text-xs"
                              >
                                Previous
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setCurrentPage(page => page + 1)}
                                disabled={currentPage * recordsPerPage >= filteredRecords.length}
                                className="text-xs"
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
} 