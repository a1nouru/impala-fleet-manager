"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, CheckCircle, Clock, Edit, Trash2, PlusCircle, Download, ChevronLeft, ChevronRight, CalendarIcon, Filter, AlertTriangle } from "lucide-react";
import { financialService, DailyReport, DailyExpense } from "@/services/financialService";
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
import { AGASEKE_PLATES, isAgasekeVehicle } from "@/lib/constants";
import { useTranslation } from "@/hooks/useTranslation";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// Helper function to determine if a report should be flagged
const isReportFlagged = (report: DailyReport) => {
  const totalRevenue = calculateTotalRevenue(report);
  const totalExpenses = (report.daily_expenses || []).reduce((sum, expense) => sum + expense.amount, 0);
  const netRevenue = calculateNetBalance(report);
  
  // Flag if net revenue is less than 50% of total revenue
  const lowNetRevenueMargin = totalRevenue > 0 && (netRevenue / totalRevenue) < 0.5;
  
  // Flag if total expenses exceed 210,000 AOA
  const highExpenses = totalExpenses > 210000;
  
  return lowNetRevenueMargin || highExpenses;
};

// Helper function to get flagging reason
const getFlaggingReason = (report: DailyReport) => {
  const totalRevenue = calculateTotalRevenue(report);
  const totalExpenses = (report.daily_expenses || []).reduce((sum, expense) => sum + expense.amount, 0);
  const netRevenue = calculateNetBalance(report);
  
  const reasons = [];
  
  if (totalRevenue > 0 && (netRevenue / totalRevenue) < 0.5) {
    const margin = ((netRevenue / totalRevenue) * 100).toFixed(1);
    reasons.push(`Low net revenue margin: ${margin}% (< 50%)`);
  }
  
  if (totalExpenses > 210000) {
    reasons.push(`High expenses: ${totalExpenses.toLocaleString()} AOA (> 210,000 AOA)`);
  }
  
  return reasons.join('; ');
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

// Utility function to export data to Excel
const exportReportsToExcel = (data: DailyReport[], filename: string) => {
  const headers = [
    "Date",
    "Vehicle Plate", 
    "Route",
    "Status",
    "Ticket Revenue (AOA)",
    "Baggage Revenue (AOA)",
    "Cargo Revenue (AOA)",
    "Total Revenue (AOA)",
    "Total Expenses (AOA)",
    "Net Balance (AOA)",
    "Non-Operational Reason"
  ];

  const excelData = [
    headers.join('\t'),
    ...data.map(report => {
      const totalRevenue = (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
      const totalExpenses = (report.daily_expenses || []).reduce((sum, expense) => sum + expense.amount, 0);
      const netBalance = totalRevenue - totalExpenses;
      
      return [
        report.report_date,
        report.vehicles?.plate || '',
        report.route || '',
        report.status || '',
        report.ticket_revenue || 0,
        report.baggage_revenue || 0,
        report.cargo_revenue || 0,
        totalRevenue,
        totalExpenses,
        netBalance,
        report.non_operational_reason || '',
      ].join('\t');
    })
  ].join('\n');

  const blob = new Blob([excelData], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' 
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function AllDailyReportsPage() {
  const { t } = useTranslation('financials');
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
  const [newExpenseData, setNewExpenseData] = useState<Partial<DailyExpense>>({ 
    category: "", 
    description: "", 
    amount: 0 
  });
  const [selectedExpenseType, setSelectedExpenseType] = useState<string>("");
  const [customExpenseType, setCustomExpenseType] = useState<string>("");

  // Filter states
  const [dateFilter, setDateFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(),
    to: new Date(),
  });
  const [groupByDate, setGroupByDate] = useState(true);
  const [reportTypeFilter, setReportTypeFilter] = useState<"all" | "agaseke" | "regular">("all");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20;

  // Download state
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadDateRange, setDownloadDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date(),
  });
  
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

  // State for delete confirmation
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<DailyReport | null>(null);

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

  // Filter reports based on date range and report type
  const filteredReports = reports.filter(report => {
    const reportDate = parseISO(report.report_date);
    
    // Date filter
    let passesDateFilter = true;
    if (dateFilter.from || dateFilter.to) {
      if (dateFilter.from && dateFilter.to) {
        passesDateFilter = isWithinInterval(reportDate, {
          start: startOfDay(dateFilter.from),
          end: endOfDay(dateFilter.to),
        });
      } else if (dateFilter.from) {
        passesDateFilter = reportDate >= startOfDay(dateFilter.from);
      } else if (dateFilter.to) {
        passesDateFilter = reportDate <= endOfDay(dateFilter.to);
      }
    }
    
    // Report type filter
    let passesReportTypeFilter = true;
    if (reportTypeFilter === "agaseke") {
      passesReportTypeFilter = isAgasekeVehicle(report.vehicles?.plate);
    } else if (reportTypeFilter === "regular") {
      passesReportTypeFilter = !isAgasekeVehicle(report.vehicles?.plate);
    }
    
    return passesDateFilter && passesReportTypeFilter;
  });

  // Pagination logic for individual reports view
  const totalRecords = filteredReports.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentPageReports = filteredReports.slice(startIndex, endIndex);

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
    
    // Safety check for undefined/null category
    const category = expense.category || "";
    
    setEditedExpenseData({
        category: category,
        description: expense.description,
        amount: expense.amount,
    });
    // Set the expense type for editing - FIXED: case-insensitive comparison
    if (category && ["fuel", "subsidy"].includes(category.toLowerCase())) {
      const mappedType = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
      setSelectedExpenseType(mappedType);
      setCustomExpenseType("");
    } else {
      setSelectedExpenseType("Other");
      setCustomExpenseType(category);
    }
    setIsExpenseDialogOpen(true);
  };

  const handleExpenseInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (editingExpense) {
        setEditedExpenseData(prev => ({ 
          ...prev, 
          [name]: name === "amount" ? parseFloat(value) || 0 : value 
        }));
    } else {
        setNewExpenseData(prev => ({ 
          ...prev, 
          [name]: name === "amount" ? parseFloat(value) || 0 : value 
        }));
    }
  };

  const handleExpenseTypeChange = (value: string) => {
    setSelectedExpenseType(value);
    if (value.toLowerCase() === "fuel") {
      if (editingExpense) {
        setEditedExpenseData(prev => ({ ...prev, category: "Fuel" }));
      } else {
        setNewExpenseData(prev => ({ ...prev, category: "Fuel" }));
      }
      setCustomExpenseType("");
    } else if (value.toLowerCase() === "subsidy") {
      if (editingExpense) {
        setEditedExpenseData(prev => ({ ...prev, category: "Subsidy" }));
      } else {
        setNewExpenseData(prev => ({ ...prev, category: "Subsidy" }));
      }
      setCustomExpenseType("");
    } else {
      if (editingExpense) {
        setEditedExpenseData(prev => ({ ...prev, category: customExpenseType }));
      } else {
        setNewExpenseData(prev => ({ ...prev, category: "" }));
      }
    }
  };

  const handleCustomExpenseTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomExpenseType(value);
    if (editingExpense) {
      setEditedExpenseData(prev => ({ ...prev, category: value }));
    } else {
      setNewExpenseData(prev => ({ ...prev, category: value }));
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
        setSelectedExpenseType("");
        setCustomExpenseType("");
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

  // Delete Report Handlers
  const handleDeleteClick = (report: DailyReport) => {
    setReportToDelete(report);
    setDeleteConfirmationOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!reportToDelete) return;
    setIsSubmitting(true);
    try {
      await financialService.deleteDailyReport(reportToDelete.id);
      toast({
        title: "✅ Success",
        description: "Daily report deleted successfully.",
      });
      fetchReports();
    } catch (error: any) {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to delete daily report.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmationOpen(false);
      setReportToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with New Report Button and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="h-6 w-6" />
            {t("allDailyReports.title")}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{filteredReports.length} {t("allDailyReports.reports")}</Badge>
            {reportTypeFilter !== "all" && (
              <Badge variant="secondary" className="text-xs">
                {reportTypeFilter === "agaseke" ? t("allDailyReports.agasekeOnly") : t("allDailyReports.regularOnly")}
              </Badge>
            )}
          </div>
        </div>
        
        <Dialog open={newReportDialogOpen} onOpenChange={setNewReportDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-gray-800 text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              {t("allDailyReports.newReport")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>{t("allDailyReports.createNewReport")}</DialogTitle>
              <DialogDescription>
                {t("allDailyReports.createReportDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_id">{t("form.vehicle")}</Label>
                  <Select name="vehicle_id" value={newReport.vehicle_id} onValueChange={(value) => handleSelectChange("vehicle_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("form.selectVehicle")} />
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
                  <Label htmlFor="report_date">{t("form.date")}</Label>
                  <Input id="report_date" name="report_date" type="date" value={newReport.report_date} onChange={handleInputChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="route">{t("form.route")}</Label>
                <Select name="route" value={newReport.route} onValueChange={(value) => handleSelectChange("route", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("form.selectRoute")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Luanda - Benguela">Luanda - Benguela</SelectItem>
                    <SelectItem value="Luanda - Huambo">Luanda - Huambo</SelectItem>
                    <SelectItem value="Luanda - Lobito">Luanda - Lobito</SelectItem>
                    <SelectItem value="Luanda - Malanje">Luanda - Malanje</SelectItem>
                    <SelectItem value="Benguela - Huambo">Benguela - Huambo</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t("form.status")}</Label>
                <Select name="status" value={newReport.status} onValueChange={(value) => handleSelectChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operational">{t("form.operational")}</SelectItem>
                    <SelectItem value="Non-Operational">{t("form.nonOperational")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newReport.status === "Non-Operational" && (
                <div className="space-y-2">
                  <Label htmlFor="non_operational_reason">{t("form.reasonForNonOperation")}</Label>
                  <Textarea
                    id="non_operational_reason"
                    name="non_operational_reason"
                    value={newReport.non_operational_reason}
                    onChange={handleInputChange}
                    placeholder={t("form.reasonPlaceholder")}
                  />
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ticket_revenue">{t("form.ticketRevenue")}</Label>
                  <Input
                    id="ticket_revenue"
                    name="ticket_revenue"
                    type="number"
                    value={newReport.ticket_revenue}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baggage_revenue">{t("form.baggageRevenue")}</Label>
                  <Input
                    id="baggage_revenue"
                    name="baggage_revenue"
                    type="number"
                    value={newReport.baggage_revenue}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo_revenue">{t("form.cargoRevenue")}</Label>
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
              <Button variant="outline" onClick={() => setNewReportDialogOpen(false)}>{t("buttons.cancel")}</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-black hover:bg-gray-800 text-white">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("buttons.createReport")}
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
              <Label>{t("filters.filters")}:</Label>
            </div>
            
            {/* Date Range Picker */}
            <div className="flex items-center gap-2">
              <Label>{t("filters.from")}:</Label>
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
                    {dateFilter.from ? format(dateFilter.from, "MMM dd") : t("filters.pickDate")}
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
              <Label>{t("filters.to")}:</Label>
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
                    {dateFilter.to ? format(dateFilter.to, "MMM dd") : t("filters.pickDate")}
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
              <Label>{t("filters.view")}:</Label>
              <Button
                variant={groupByDate ? "default" : "outline"}
                size="sm"
                onClick={() => setGroupByDate(true)}
              >
                {t("filters.groupedByDate")}
              </Button>
              <Button
                variant={!groupByDate ? "default" : "outline"}
                size="sm"
                onClick={() => setGroupByDate(false)}
              >
                {t("filters.individualReports")}
              </Button>
            </div>

            {/* Report Type Filter */}
            <div className="flex items-center gap-2">
              <Label>{t("filters.reportType")}:</Label>
              <Select 
                value={reportTypeFilter} 
                onValueChange={(value: "all" | "agaseke" | "regular") => setReportTypeFilter(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allVehicles")}</SelectItem>
                  <SelectItem value="agaseke">{t("filters.agasekeVehicles")}</SelectItem>
                  <SelectItem value="regular">{t("filters.regularVehicles")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter({ from: new Date(), to: new Date() });
              }}
            >
              {t("filters.today")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter({ from: undefined, to: undefined });
                setReportTypeFilter("all");
              }}
            >
              {t("filters.clearFilters")}
            </Button>

            {/* Download Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDownloadDialogOpen(true)}
              className="h-9"
            >
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Download</span>
              <span className="sm:hidden">Excel</span>
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
                  <TableHead>{t("table.date")}</TableHead>
                  <TableHead>{t("table.vehicles")}</TableHead>
                  <TableHead className="text-right">{t("table.totalRevenue")}</TableHead>
                  <TableHead className="text-right">{t("table.totalExpenses")}</TableHead>
                  <TableHead className="text-right">{t("table.netBalance")}</TableHead>
                  <TableHead>{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((group) => (
                  <TableRow key={group.date}>
                    <TableCell>{format(parseISO(group.date), "MMMM do, yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span>{t("allDailyReports.vehicleCount", { count: group.vehicleCount })}</span>
                          {(() => {
                            const agasekeCount = group.reports.filter(r => isAgasekeVehicle(r.vehicles?.plate)).length;
                            const regularCount = group.vehicleCount - agasekeCount;
                            return (
                              <div className="flex gap-1">
                                {agasekeCount > 0 && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                                    {t("allDailyReports.agasekeCount", { count: agasekeCount })}
                                  </Badge>
                                )}
                                {regularCount > 0 && (
                                  <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                                    {t("allDailyReports.regularCount", { count: regularCount })}
                                  </Badge>
                                )}
                              </div>
                            );
                          })()}
                        </div>
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
                        {t("table.viewDetails")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-bold">{t("table.total")}</TableCell>
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
                      <TableHead>{t("table.date")}</TableHead>
                      <TableHead>{t("table.vehicle")}</TableHead>
                      <TableHead>{t("table.route")}</TableHead>
                      <TableHead>{t("table.status")}</TableHead>
                      <TableHead>{t("table.revenue")}</TableHead>
                      <TableHead>{t("table.expenses")}</TableHead>
                      <TableHead>{t("table.net")}</TableHead>
                      <TableHead className="text-right">{t("table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPageReports.map((report) => {
                      const isFlagged = isReportFlagged(report);
                      const flaggingReason = isFlagged ? getFlaggingReason(report) : '';
                      
                      return (
                        <TableRow key={report.id} className={isFlagged ? "bg-red-100" : ""}>
                          <TableCell>{format(parseISO(report.report_date), "PP")}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{report.vehicles?.plate}</span>
                              {isFlagged && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="h-4 w-4 text-amber-500 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>⚠️ Report flagged: {flaggingReason}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {isAgasekeVehicle(report.vehicles?.plate) && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                                  {t("status.agaseke")}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        <TableCell>{report.route}</TableCell>
                        <TableCell><Badge variant={report.status === 'Operational' ? 'default' : 'destructive'}>{report.status === 'Operational' ? t("status.operational") : t("status.nonOperational")}</Badge></TableCell>
                        <TableCell className="text-right">{formatCurrency(calculateTotalRevenue(report))}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {formatCurrency((report.daily_expenses || []).reduce((sum, expense) => sum + expense.amount, 0))}
                            {(!report.daily_expenses || report.daily_expenses.length === 0) && (
                              <div className="w-2 h-2 bg-red-500 rounded-full" title={t("expenses.noExpensesIndicator")}></div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(calculateNetBalance(report))}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(report)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:text-red-600"
                                  onClick={() => handleDeleteClick(report)}
                                  disabled={report.deposit_reports && report.deposit_reports.length > 0}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{report.deposit_reports && report.deposit_reports.length > 0 
                                  ? "Cannot delete report that is associated with bank deposits" 
                                  : "Delete"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-bold">{t("table.total")}</TableCell>
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
                  <p className="text-sm">{t("allDailyReports.noReportsFound")}</p>
                </div>
              )}
              
              {/* Pagination Controls for Individual Reports */}
              {!groupByDate && filteredReports.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 border-t space-y-2 sm:space-y-0">
                  <div className="text-sm text-muted-foreground text-center sm:text-left">
                    Showing <span className="font-medium">{currentPageReports.length}</span> of{" "}
                    <span className="font-medium">{totalRecords}</span> reports
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
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
              <DialogTitle>{t("allDailyReports.editReport")}</DialogTitle>
              <DialogDescription>
                {t("allDailyReports.editReportDescription", { 
                  plate: editingReport.vehicles?.plate, 
                  date: format(parseISO(editingReport.report_date), "PPP") 
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              {/* Report Details Form */}
              <div className="space-y-4">
                <h4 className="font-medium text-lg">{t("form.reportDetails")}</h4>
                                  <div className="space-y-2">
                    <Label>{t("form.status")}</Label>
                    <Select value={editedReportData.status} onValueChange={(value) => handleReportSelectChange("status", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Operational">{t("form.operational")}</SelectItem>
                        <SelectItem value="Non-Operational">{t("form.nonOperational")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                                  {editedReportData.status === "Non-Operational" && (
                    <div className="space-y-2">
                      <Label>{t("form.reasonForNonOperation")}</Label>
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
                      <SelectItem value="Luanda - Benguela">Luanda - Benguela</SelectItem>
                      <SelectItem value="Luanda - Huambo">Luanda - Huambo</SelectItem>
                      <SelectItem value="Luanda - Lobito">Luanda - Lobito</SelectItem>
                      <SelectItem value="Luanda - Malanje">Luanda - Malanje</SelectItem>
                      <SelectItem value="Benguela - Huambo">Benguela - Huambo</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
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
                          setSelectedExpenseType("");
                          setCustomExpenseType("");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Select 
                            value={selectedExpenseType} 
                            onValueChange={handleExpenseTypeChange}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder={t("expenses.selectExpenseType")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Fuel">🔷 {t("expenses.categories.fuel")}</SelectItem>
                              <SelectItem value="Subsidy">💰 {t("expenses.categories.subsidy")}</SelectItem>
                              <SelectItem value="Other">📝 {t("expenses.categories.other")}</SelectItem>
                            </SelectContent>
                          </Select>
                          {selectedExpenseType === "Other" && (
                            <Input 
                              placeholder={t("expenses.specifyType")} 
                              value={customExpenseType} 
                              onChange={handleCustomExpenseTypeChange}
                              className="text-sm mt-2"
                            />
                          )}
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
              <Label>{t("expenses.expenseType")}</Label>
              <Select 
                value={selectedExpenseType} 
                onValueChange={(value) => {
                  setSelectedExpenseType(value);
                  if (value !== "Other") {
                    setEditedExpenseData(prev => ({ ...prev, category: value }));
                    setCustomExpenseType("");
                  } else {
                    setEditedExpenseData(prev => ({ ...prev, category: customExpenseType }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("expenses.selectExpenseType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fuel">🔷 {t("expenses.categories.fuel")}</SelectItem>
                  <SelectItem value="Subsidy">💰 {t("expenses.categories.subsidy")}</SelectItem>
                  <SelectItem value="Other">📝 {t("expenses.categories.other")}</SelectItem>
                </SelectContent>
              </Select>
              {selectedExpenseType === "Other" && (
                <Input 
                  placeholder={t("expenses.specifyType")} 
                  value={customExpenseType} 
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomExpenseType(value);
                    setEditedExpenseData(prev => ({ ...prev, category: value }));
                  }}
                  className="mt-2"
                />
              )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {reportToDelete && (
                `This action cannot be undone. This will permanently delete the daily report for ${reportToDelete.vehicles?.plate} on ${format(parseISO(reportToDelete.report_date), "PPP")} and all its associated expenses.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Download dialog */}
      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent>
                     <DialogHeader>
             <DialogTitle>Download Daily Reports</DialogTitle>
             <DialogDescription>
               Select a date range to download daily reports as Excel file.
             </DialogDescription>
           </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="downloadFrom">From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !downloadDateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {downloadDateRange.from ? format(downloadDateRange.from, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={downloadDateRange.from}
                    onSelect={(date) => setDownloadDateRange(prev => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="downloadTo">To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !downloadDateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {downloadDateRange.to ? format(downloadDateRange.to, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={downloadDateRange.to}
                    onSelect={(date) => setDownloadDateRange(prev => ({ ...prev, to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDownloadDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const from = downloadDateRange.from ? format(downloadDateRange.from, "yyyy-MM-dd") : undefined;
                const to = downloadDateRange.to ? format(downloadDateRange.to, "yyyy-MM-dd") : undefined;
                const filteredData = reports.filter(r => {
                  const recordDate = new Date(r.report_date);
                  const isFromDate = from ? recordDate >= new Date(from) : true;
                  const isToDate = to ? recordDate <= new Date(to) : true;
                  return isFromDate && isToDate;
                });
                                 exportReportsToExcel(filteredData, `daily_reports_${from || 'all'}_to_${to || 'all'}.xlsx`);
                setDownloadDialogOpen(false);
                toast({
                  title: "Download Started",
                  description: `Downloading ${filteredData.length} reports...`
                });
              }}
            >
                             Download Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
