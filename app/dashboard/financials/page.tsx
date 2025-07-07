"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlusCircle, FileText, CheckCircle, Clock, Edit, Trash2, CalendarIcon, Filter } from "lucide-react";
import { financialService, DailyReport, DailyExpense, COMMON_ROUTES } from "@/services/financialService";
import { vehicleService } from "@/services/vehicleService";
import { toast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, isToday, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Define a type for vehicles to be used in the form
interface Vehicle {
  id: string;
  plate: string;
}

// Helper function to calculate total revenue
const calculateTotalRevenue = (report: DailyReport) => {
  return (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
};

// Helper function to calculate net balance
const calculateNetBalance = (report: DailyReport) => {
  const totalRevenue = (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
  const totalExpenses = (report.daily_expenses || []).reduce((sum, expense) => sum + expense.amount, 0);
  return totalRevenue - totalExpenses;
};

// Helper to format currency
const formatCurrency = (value: number) => {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "AOA",
  });
};

// Group reports by date
const groupReportsByDate = (reports: DailyReport[]) => {
  const grouped = reports.reduce((acc, report) => {
    const date = format(parseISO(report.report_date), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(report);
    return acc;
  }, {} as Record<string, DailyReport[]>);

  return Object.entries(grouped).map(([date, reports]) => ({
    date,
    reports,
    totalRevenue: reports.reduce((sum, r) => sum + calculateTotalRevenue(r), 0),
    totalExpenses: reports.reduce((sum, r) => sum + (r.daily_expenses || []).reduce((exp, e) => exp + e.amount, 0), 0),
    netBalance: reports.reduce((sum, r) => sum + calculateNetBalance(r), 0),
    vehicleCount: reports.length,
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export default function AllDailyReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Dialog states
  const [newReportDialogOpen, setNewReportDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<DailyReport | null>(null);
  const [editedReportData, setEditedReportData] = useState<{
    vehicle_id: string;
    report_date: string;
    route: string;
    status: 'Operational' | 'Non-Operational';
    non_operational_reason: string;
    ticket_revenue: number;
    baggage_revenue: number;
    cargo_revenue: number;
  }>({
    vehicle_id: "",
    report_date: "",
    route: "",
    status: "Operational",
    non_operational_reason: "",
    ticket_revenue: 0,
    baggage_revenue: 0,
    cargo_revenue: 0,
  });
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<DailyExpense | null>(null);
  const [editedExpenseData, setEditedExpenseData] = useState<Partial<DailyExpense>>({});
  const [newExpenseData, setNewExpenseData] = useState<Partial<DailyExpense>>({ category: "", description: "", amount: 0 });

  // Filter states
  const [dateFilter, setDateFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(),
    to: new Date(),
  });
  const [groupByDate, setGroupByDate] = useState(true);
  
  // New report form state
  const [newReport, setNewReport] = useState<{
    vehicle_id: string;
    report_date: string;
    route: string;
    status: 'Operational' | 'Non-Operational';
    non_operational_reason: string;
    ticket_revenue: number;
    baggage_revenue: number;
    cargo_revenue: number;
  }>({
    vehicle_id: "",
    report_date: format(new Date(), "yyyy-MM-dd"),
    route: "",
    status: "Operational",
    non_operational_reason: "",
    ticket_revenue: 0,
    baggage_revenue: 0,
    cargo_revenue: 0,
  });

  // State for adding new expenses
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const [reportsData, vehiclesData] = await Promise.all([
        financialService.getDailyReports(),
        vehicleService.getVehicles(),
      ]);
      setReports(reportsData);
      setVehicles(vehiclesData || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load daily reports.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Filter reports based on date range
  const filteredReports = reports.filter(report => {
    const reportDate = parseISO(report.report_date);
    if (!dateFilter.from && !dateFilter.to) return true;
    if (dateFilter.from && dateFilter.to) {
      return isWithinInterval(reportDate, {
        start: startOfDay(dateFilter.from),
        end: endOfDay(dateFilter.to),
      });
    }
    if (dateFilter.from) {
      return reportDate >= startOfDay(dateFilter.from);
    }
    if (dateFilter.to) {
      return reportDate <= endOfDay(dateFilter.to);
    }
    return true;
  });

  // Group or show individual reports
  const displayData = groupByDate ? groupReportsByDate(filteredReports) : null;

  // New Report Form Handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewReport((prev) => ({
      ...prev,
      [name]: name.includes("revenue") ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setNewReport((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setNewReport({
      vehicle_id: "",
      report_date: format(new Date(), "yyyy-MM-dd"),
      route: "",
      status: "Operational",
      non_operational_reason: "",
      ticket_revenue: 0,
      baggage_revenue: 0,
      cargo_revenue: 0,
    });
  };

  const handleSubmit = async () => {
    if (!newReport.vehicle_id || !newReport.report_date || !newReport.status) {
      toast({
        title: "Validation Error",
        description: "Please fill out all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Only send fields that actually exist in the daily_reports table
      const reportData = {
        vehicle_id: newReport.vehicle_id,
        report_date: newReport.report_date,
        route: newReport.route || null, // Send null if empty string
        status: newReport.status,
        non_operational_reason: newReport.non_operational_reason || null,
        ticket_revenue: newReport.ticket_revenue,
        baggage_revenue: newReport.baggage_revenue,
        cargo_revenue: newReport.cargo_revenue,
      };
      await financialService.createDailyReport(reportData);
      toast({
        title: "Success",
        description: "New financial report created.",
      });
      setNewReportDialogOpen(false);
      resetForm();
      fetchReports(); // Refresh reports
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create report. A report for this vehicle on this day may already exist.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Report Handlers
  const handleEditClick = (report: DailyReport) => {
    setEditingReport(report);
    setEditedReportData({
      vehicle_id: report.vehicle_id,
      report_date: report.report_date,
      route: report.route || "",
      status: report.status,
      non_operational_reason: report.non_operational_reason || "",
      ticket_revenue: report.ticket_revenue,
      baggage_revenue: report.baggage_revenue,
      cargo_revenue: report.cargo_revenue,
    });
    setIsEditDialogOpen(true);
  };

  const handleReportInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedReportData(prev => ({ ...prev, [name]: value }));
  };

  const handleReportSelectChange = (name: string, value: string) => {
    setEditedReportData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateReport = async () => {
    if (!editingReport) return;
    try {
        await financialService.updateDailyReport(editingReport.id, editedReportData);
        toast({ title: "Success", description: "Report updated successfully." });
        setIsEditDialogOpen(false);
        fetchReports(); // Refresh data
    } catch (error) {
        toast({ title: "Error", description: "Failed to update report.", variant: "destructive" });
    }
  };

  // Expense Handlers
  const handleEditExpenseClick = (expense: DailyExpense) => {
    setEditingExpense(expense);
    setEditedExpenseData({
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
    });
    setIsExpenseDialogOpen(true);
  };

  const handleExpenseInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (editingExpense) {
        setEditedExpenseData(prev => ({ ...prev, [name]: value }));
    } else {
        setNewExpenseData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddNewExpense = async () => {
    if (!editingReport || !newExpenseData.category || !newExpenseData.amount) {
        toast({ title: "Error", description: "Please provide a category and amount for the new expense.", variant: "destructive" });
        return;
    }
    try {
        await financialService.createDailyExpense({ report_id: editingReport.id, ...newExpenseData } as DailyExpense);
        toast({ title: "Success", description: "Expense added successfully." });
        setNewExpenseData({ category: "", description: "", amount: 0 });
        setIsAddingExpense(false);
        const updatedReport = await financialService.getDailyReportById(editingReport.id);
        if (updatedReport) setEditingReport(updatedReport);
    } catch (error) {
        toast({ title: "Error", description: "Failed to add expense.", variant: "destructive" });
    }
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense) return;
    try {
        await financialService.updateDailyExpense(editingExpense.id, editedExpenseData);
        toast({ title: "Success", description: "Expense updated." });
        setIsExpenseDialogOpen(false);
        if(editingReport) {
            const updatedReport = await financialService.getDailyReportById(editingReport.id);
            if (updatedReport) setEditingReport(updatedReport);
        }
    } catch (error) {
        toast({ title: "Error", description: "Failed to update expense.", variant: "destructive" });
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
        try {
            await financialService.deleteDailyExpense(expenseId);
            toast({ title: "Success", description: "Expense deleted." });
            if(editingReport) {
                const updatedReport = await financialService.getDailyReportById(editingReport.id);
                if (updatedReport) setEditingReport(updatedReport);
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete expense.", variant: "destructive" });
        }
    }
  };

  const handleDeleteReport = async (reportId: string, vehiclePlate: string) => {
    if (window.confirm(`Are you sure you want to delete the daily report for vehicle ${vehiclePlate}? This action cannot be undone and will also delete all related expenses.`)) {
        try {
            await financialService.deleteDailyReport(reportId);
            toast({ 
                title: "✅ Success", 
                description: "Daily report deleted successfully." 
            });
            fetchReports(); // Refresh the reports list
        } catch (error) {
            toast({ 
                title: "❌ Error", 
                description: "Failed to delete daily report.", 
                variant: "destructive" 
            });
        }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with New Report Button and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="h-6 w-6" />
            All Daily Reports
          </h1>
          <Badge variant="outline">{filteredReports.length} reports</Badge>
        </div>
        
        <Dialog open={newReportDialogOpen} onOpenChange={setNewReportDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-gray-800 text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Report
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Create New Financial Report</DialogTitle>
              <DialogDescription>
                Fill in the details for the daily report. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_id">Vehicle</Label>
                  <Select name="vehicle_id" value={newReport.vehicle_id} onValueChange={(value) => handleSelectChange("vehicle_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.plate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report_date">Date</Label>
                  <Input id="report_date" name="report_date" type="date" value={newReport.report_date} onChange={handleInputChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="route">Route</Label>
                <Select name="route" value={newReport.route} onValueChange={(value) => handleSelectChange("route", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a route" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_ROUTES.map((route) => (
                      <SelectItem key={route} value={route}>
                        {route}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" value={newReport.status} onValueChange={(value) => handleSelectChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operational">Operational</SelectItem>
                    <SelectItem value="Non-Operational">Non-Operational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newReport.status === "Non-Operational" && (
                <div className="space-y-2">
                  <Label htmlFor="non_operational_reason">Reason for Non-Operation</Label>
                  <Textarea
                    id="non_operational_reason"
                    name="non_operational_reason"
                    value={newReport.non_operational_reason}
                    onChange={handleInputChange}
                    placeholder="Please provide a reason..."
                  />
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ticket_revenue">Ticket Revenue</Label>
                  <Input
                    id="ticket_revenue"
                    name="ticket_revenue"
                    type="number"
                    value={newReport.ticket_revenue}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baggage_revenue">Baggage Revenue</Label>
                  <Input
                    id="baggage_revenue"
                    name="baggage_revenue"
                    type="number"
                    value={newReport.baggage_revenue}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo_revenue">Cargo Revenue</Label>
                  <Input
                    id="cargo_revenue"
                    name="cargo_revenue"
                    type="number"
                    value={newReport.cargo_revenue}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewReportDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-black hover:bg-gray-800 text-white">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <Label>Filters:</Label>
            </div>
            
            {/* Date Range Picker */}
            <div className="flex items-center gap-2">
              <Label>From:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !dateFilter.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter.from ? format(dateFilter.from, "MMM dd") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFilter.from}
                    onSelect={(date) => setDateFilter(prev => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <Label>To:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !dateFilter.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter.to ? format(dateFilter.to, "MMM dd") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFilter.to}
                    onSelect={(date) => setDateFilter(prev => ({ ...prev, to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <Label>View:</Label>
              <Button
                variant={groupByDate ? "default" : "outline"}
                size="sm"
                onClick={() => setGroupByDate(true)}
              >
                Grouped by Date
              </Button>
              <Button
                variant={!groupByDate ? "default" : "outline"}
                size="sm"
                onClick={() => setGroupByDate(false)}
              >
                Individual Reports
              </Button>
            </div>

            {/* Clear Filters */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter({ from: new Date(), to: new Date() });
              }}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter({ from: undefined, to: undefined });
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : groupByDate && displayData ? (
            // Grouped by Date View
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicles</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">Total Expenses</TableHead>
                  <TableHead className="text-right">Net Balance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((group) => (
                  <TableRow key={group.date}>
                    <TableCell>{format(parseISO(group.date), "MMMM do, yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{group.vehicleCount} vehicles</span>
                        <span className="text-xs text-muted-foreground">
                          {group.reports.map(r => r.vehicles?.plate).join(', ')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(group.totalRevenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(group.totalExpenses)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(group.netBalance)}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => {
                        const from = startOfDay(parseISO(group.date));
                        const to = endOfDay(parseISO(group.date));
                        setDateFilter({ from, to });
                        setGroupByDate(false);
                      }}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(displayData.reduce((acc, group) => acc + group.totalRevenue, 0))}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(displayData.reduce((acc, group) => acc + group.totalExpenses, 0))}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(displayData.reduce((acc, group) => acc + group.netBalance, 0))}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            // Individual Reports View
            <>
              {filteredReports.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Expenses</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>{format(parseISO(report.report_date), "PP")}</TableCell>
                        <TableCell>{report.vehicles?.plate}</TableCell>
                        <TableCell>{report.route}</TableCell>
                        <TableCell><Badge variant={report.status === 'Operational' ? 'default' : 'destructive'}>{report.status}</Badge></TableCell>
                        <TableCell className="text-right">{formatCurrency(calculateTotalRevenue(report))}</TableCell>
                        <TableCell className="text-right">{formatCurrency((report.daily_expenses || []).reduce((sum, expense) => sum + expense.amount, 0))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(calculateNetBalance(report))}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(report)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteReport(report.id, report.vehicles?.plate || 'Unknown')}
                              className="hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(filteredReports.reduce((acc, report) => acc + calculateTotalRevenue(report), 0))}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(filteredReports.reduce((acc, report) => acc + (report.daily_expenses || []).reduce((sum, expense) => sum + expense.amount, 0), 0))}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(filteredReports.reduce((acc, report) => acc + calculateNetBalance(report), 0))}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No reports found</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Report Dialog */}
      {editingReport && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Edit Daily Report</DialogTitle>
              <DialogDescription>
                Editing report for vehicle {editingReport.vehicles?.plate} on {format(parseISO(editingReport.report_date), "PPP")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              {/* Report Details Form */}
              <div className="space-y-4">
                <h4 className="font-medium text-lg">Report Details</h4>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editedReportData.status} onValueChange={(value) => handleReportSelectChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Operational">Operational</SelectItem>
                      <SelectItem value="Non-Operational">Non-Operational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editedReportData.status === "Non-Operational" && (
                  <div className="space-y-2">
                    <Label>Reason for Non-Operation</Label>
                    <Textarea name="non_operational_reason" value={editedReportData.non_operational_reason || ""} onChange={handleReportInputChange} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input name="report_date" type="date" value={editedReportData.report_date} onChange={handleReportInputChange} />
                </div>
                <div className="space-y-2">
                  <Label>Route</Label>
                  <Select name="route" value={editedReportData.route} onValueChange={(value) => handleReportSelectChange("route", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a route" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_ROUTES.map((route) => (
                        <SelectItem key={route} value={route}>
                          {route}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ticket Revenue</Label>
                  <Input name="ticket_revenue" type="number" value={editedReportData.ticket_revenue || 0} onChange={handleReportInputChange} />
                </div>
                <div className="space-y-2">
                  <Label>Baggage Revenue</Label>
                  <Input name="baggage_revenue" type="number" value={editedReportData.baggage_revenue || 0} onChange={handleReportInputChange} />
                </div>
                <div className="space-y-2">
                  <Label>Cargo Revenue</Label>
                  <Input name="cargo_revenue" type="number" value={editedReportData.cargo_revenue || 0} onChange={handleReportInputChange} />
                </div>
              </div>

              {/* Expenses Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-lg">Expenses</h4>
                  {!isAddingExpense && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsAddingExpense(true)}
                      className="flex items-center gap-1"
                    >
                      <PlusCircle className="h-4 w-4" />
                      Add
                    </Button>
                  )}
                </div>
                
                {/* Expense List */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {editingReport.daily_expenses && editingReport.daily_expenses.length > 0 ? (
                    editingReport.daily_expenses.map(expense => (
                      <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <div>
                          <p className="font-medium text-sm">{expense.category}</p>
                          <p className="text-sm text-muted-foreground">{formatCurrency(expense.amount)}</p>
                          {expense.description && (
                            <p className="text-xs text-muted-foreground mt-1">{expense.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditExpenseClick(expense)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteExpense(expense.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No expenses recorded</p>
                    </div>
                  )}
                </div>
                
                {/* Add New Expense Form - Improved */}
                {isAddingExpense && (
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-sm">New Expense</h5>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setIsAddingExpense(false);
                          setNewExpenseData({ category: "", description: "", amount: 0 });
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Input 
                            name="category" 
                            placeholder="Category" 
                            value={newExpenseData.category || ""} 
                            onChange={handleExpenseInputChange}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Input 
                            name="amount" 
                            type="number" 
                            placeholder="0.00" 
                            value={newExpenseData.amount || ""} 
                            onChange={handleExpenseInputChange}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      
                      <Textarea 
                        name="description" 
                        placeholder="Description (optional)" 
                        value={newExpenseData.description || ""} 
                        onChange={handleExpenseInputChange}
                        className="text-sm resize-none"
                        rows={2}
                      />
                      
                      <Button 
                        size="sm" 
                        onClick={handleAddNewExpense}
                        className="w-full bg-black hover:bg-gray-800 text-white"
                        disabled={!newExpenseData.category || !newExpenseData.amount}
                      >
                        Add Expense
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateReport}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Expense Dialog */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Input name="category" value={editedExpenseData.category} onChange={handleExpenseInputChange} />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input name="amount" type="number" value={editedExpenseData.amount} onChange={handleExpenseInputChange} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea name="description" value={editedExpenseData.description || ""} onChange={handleExpenseInputChange} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateExpense}>Save Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
