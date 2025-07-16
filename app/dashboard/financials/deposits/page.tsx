"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlusCircle, Edit, CalendarIcon, Filter, Banknote, Paperclip, Eye, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { financialService, BankDeposit, DailyReport } from "@/services/financialService";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AGASEKE_PLATES, isAgasekeVehicle } from "@/lib/constants";

// Helper function to calculate total revenue
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

// Group deposits by date
const groupDepositsByDate = (deposits: BankDeposit[]) => {
  const grouped = deposits.reduce((acc, deposit) => {
    const date = format(parseISO(deposit.deposit_date), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(deposit);
    return acc;
  }, {} as Record<string, BankDeposit[]>);

  return Object.entries(grouped).map(([date, deposits]) => ({
    date,
    deposits,
    totalAmount: deposits.reduce((sum, d) => sum + d.amount, 0),
    reportCount: deposits.reduce((sum, d) => sum + (d.deposit_reports?.length || 0), 0),
    depositCount: deposits.length,
    banks: [...new Set(deposits.map(d => d.bank_name))],
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Group undeposited reports by date for dialog display
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
    totalAmount: reports.reduce((sum, report) => sum + calculateNetBalance(report), 0),
    depositableReports: reports.filter(report => {
      const netBalance = calculateNetBalance(report);
      const isDepositable = netBalance > 0;
      const isAlreadyDeposited = report.deposit_reports && report.deposit_reports.length > 0;
      return isDepositable && !isAlreadyDeposited;
    }),
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export default function BankDepositsPage() {
  const { user } = useAuth();
  const { t } = useTranslation('financials');
  const [deposits, setDeposits] = useState<BankDeposit[]>([]);
  const [undepositedReports, setUndepositedReports] = useState<DailyReport[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [expandedDates, setExpandedDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [depositToDelete, setDepositToDelete] = useState<BankDeposit | null>(null);
  const [selectedDeposit, setSelectedDeposit] = useState<BankDeposit | null>(null);
  const [showDepositDetails, setShowDepositDetails] = useState(false);
  const [depositReports, setDepositReports] = useState<DailyReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  
  // State for the edit dialog - simplified
  const [editingDeposit, setEditingDeposit] = useState<BankDeposit | null>(null);

  // Filter states
  const [dateFilter, setDateFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(),
    to: new Date(),
  });
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [groupByDate, setGroupByDate] = useState(true);

  // State for creating new deposits
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [bankSlipFile, setBankSlipFile] = useState<File | null>(null);
  const [newDeposit, setNewDeposit] = useState({
    bank_name: "Caixa Angola" as const,
    deposit_date: format(new Date(), "yyyy-MM-dd"),
    amount: 0,
  });

  // Add state for all reports
  const [allReports, setAllReports] = useState<DailyReport[]>([]);

  const fetchPageData = async () => {
    try {
      setIsLoading(true);
      const [depositsData, undepositedData] = await Promise.all([
        financialService.getBankDeposits(),
        financialService.getUndepositedReports(),
      ]);
      setDeposits(depositsData);
      setUndepositedReports(undepositedData);
    } catch (error) {
      toast({
        title: "Error",
        description: t("messages.errorLoading"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all reports on mount for net balance calculation
  useEffect(() => {
    const fetchAllReports = async () => {
      try {
        const reports = await financialService.getDailyReports();
        setAllReports(reports);
      } catch (error) {
        // Optionally toast error
      }
    };
    fetchAllReports();
  }, []);

  useEffect(() => {
    fetchPageData();
  }, []);

  // Recalculate deposit amount when selected reports change
  useEffect(() => {
    const total = selectedReports.reduce((sum, reportId) => {
      const report = undepositedReports.find((r) => r.id === reportId);
      return sum + (report ? calculateNetBalance(report) : 0);
    }, 0);
    setNewDeposit((prev) => ({ ...prev, amount: total }));
  }, [selectedReports, undepositedReports]);

  // Auto-set deposit date to latest report date when reports are selected
  useEffect(() => {
    if (selectedReports.length > 0) {
      const selectedReportDates = selectedReports
        .map(reportId => undepositedReports.find(r => r.id === reportId)?.report_date)
        .filter(Boolean)
        .sort()
        .reverse();
      
      if (selectedReportDates.length > 0) {
        const latestDate = selectedReportDates[0];
        setNewDeposit((prev) => ({ 
          ...prev, 
          deposit_date: format(parseISO(latestDate!), "yyyy-MM-dd")
        }));
      }
    }
  }, [selectedReports, undepositedReports]);

  // Filter deposits based on date range and bank
  const filteredDeposits = deposits.filter(deposit => {
    const depositDate = parseISO(deposit.deposit_date);
    
    // Date filter
    let dateMatch = true;
    if (dateFilter.from || dateFilter.to) {
      if (dateFilter.from && dateFilter.to) {
        dateMatch = isWithinInterval(depositDate, {
          start: startOfDay(dateFilter.from),
          end: endOfDay(dateFilter.to),
        });
      } else if (dateFilter.from) {
        dateMatch = depositDate >= startOfDay(dateFilter.from);
      } else if (dateFilter.to) {
        dateMatch = depositDate <= endOfDay(dateFilter.to);
      }
    }
    
    // Bank filter
    const bankMatch = bankFilter === "all" || deposit.bank_name === bankFilter;
    
    return dateMatch && bankMatch;
  });

  // Group or show individual deposits
  const displayData = groupByDate ? groupDepositsByDate(filteredDeposits) : null;

  const handleSelectChange = (name: string, value: string) => {
    setNewDeposit((prev) => ({ ...prev, [name]: value as "Caixa Angola" | "BAI" }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewDeposit((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleReportSelection = (reportId: string) => {
    setSelectedReports((prev) =>
      prev.includes(reportId)
        ? prev.filter((id) => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleDateSelection = (date: string) => {
    const groupedReports = groupReportsByDate(undepositedReports);
    const dateGroup = groupedReports.find(group => group.date === date);
    
    if (!dateGroup) return;
    
    const dateReportIds = dateGroup.depositableReports.map(report => report.id);
    const isDateSelected = selectedDates.includes(date);
    
    if (isDateSelected) {
      // Unselect all reports from this date
      setSelectedReports(prev => prev.filter(id => !dateReportIds.includes(id)));
      setSelectedDates(prev => prev.filter(d => d !== date));
    } else {
      // Select all depositable reports from this date
      setSelectedReports(prev => [...prev, ...dateReportIds.filter(id => !prev.includes(id))]);
      setSelectedDates(prev => [...prev, date]);
    }
  };

  const handleDateExpansion = (date: string) => {
    setExpandedDates(prev => 
      prev.includes(date) 
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  // Update selected dates when individual reports are selected/deselected
  useEffect(() => {
    const groupedReports = groupReportsByDate(undepositedReports);
    const newSelectedDates: string[] = [];
    
    groupedReports.forEach(group => {
      const dateReportIds = group.depositableReports.map(report => report.id);
      const isFullDateSelected = dateReportIds.length > 0 && dateReportIds.every(id => selectedReports.includes(id));
      
      if (isFullDateSelected) {
        newSelectedDates.push(group.date);
      }
    });
    
    setSelectedDates(newSelectedDates);
  }, [selectedReports, undepositedReports]);
  
  // --- Handlers for the Edit functionality (Refactored) ---

  const handleEditClick = (deposit: BankDeposit) => {
    // Set the full deposit object to state. This will be our working copy.
    setEditingDeposit({
        ...deposit,
        // Ensure date is in 'yyyy-MM-dd' format for the input
        deposit_date: format(new Date(deposit.deposit_date), "yyyy-MM-dd"),
    });
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingDeposit) return;
    const { name, value } = e.target;
    setEditingDeposit({
        ...editingDeposit,
        [name]: name === 'amount' ? parseFloat(value) || 0 : value,
    });
  };

  const handleEditSelectChange = (name: string, value: string) => {
    if (!editingDeposit) return;
    setEditingDeposit({
        ...editingDeposit,
        [name]: value as "Caixa Angola" | "BAI",
    });
  };

  const handleUpdateSubmit = async () => {
    if (!editingDeposit) return;
    
    if (!editingDeposit.bank_name || !editingDeposit.deposit_date || editingDeposit.amount <= 0) {
      toast({
        title: t("messages.validationError"),
        description: t("messages.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await financialService.updateBankDeposit(editingDeposit.id, {
        bank_name: editingDeposit.bank_name,
        deposit_date: editingDeposit.deposit_date,
        amount: editingDeposit.amount,
      });
      toast({
        title: "Success",
        description: t("messages.depositUpdated"),
      });
      setEditingDeposit(null); // Close dialog
      fetchPageData(); // Refresh all data
    } catch (error) {
      toast({
        title: "Error",
        description: t("messages.errorUpdating"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteClick = (deposit: BankDeposit) => {
    setDepositToDelete(deposit);
    setDeleteConfirmationOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!depositToDelete) return;
    setIsSubmitting(true);
    try {
      await financialService.deleteBankDeposit(depositToDelete.id);
      toast({
        title: "Success",
        description: t("messages.depositDeleted"),
      });
      fetchPageData();
    } catch (error) {
      toast({
        title: "Error",
        description: t("messages.errorDeleting"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmationOpen(false);
      setDepositToDelete(null);
    }
  };

  // --- (end of refactored handlers) ---

  const handleSubmit = async () => {
    if (selectedReports.length === 0) {
      toast({
        title: "⚠️ No Reports Selected",
        description: "Please select at least one report for this deposit.",
        variant: "destructive",
      });
      return;
    }
    
          if (!bankSlipFile) {
        toast({
        title: "📄 Bank Slip Required",
        description: "Please upload a bank slip (PDF, JPG, or PNG) before proceeding.",
          variant: "destructive",
        });
        return;
      }

    try {
    setIsSubmitting(true);
      
      const depositData = {
        bank_name: newDeposit.bank_name,
        deposit_date: newDeposit.deposit_date,
        amount: newDeposit.amount,
        created_by: user?.email,
      };

      await financialService.createBankDepositWithFile(
        depositData,
        selectedReports,
        bankSlipFile
      );

      toast({
        title: "✅ Deposit Created Successfully",
        description: `Bank deposit of ${formatCurrency(newDeposit.amount)} has been logged with ${selectedReports.length} reports.`,
      });

      // Reset form and refresh data
      resetDepositForm();
      setDialogOpen(false);
      await fetchPageData();
    } catch (error) {
      console.error("❌ Error creating deposit:", error);
      toast({
        title: "❌ Error Creating Deposit",
        description: "There was an error creating the bank deposit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetDepositForm = () => {
    setNewDeposit({
      bank_name: "Caixa Angola",
      deposit_date: format(new Date(), "yyyy-MM-dd"),
      amount: 0,
    });
    setSelectedReports([]);
    setSelectedDates([]);
    setExpandedDates([]);
    setBankSlipFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: t("messages.invalidFileType"),
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: t("messages.fileTooLarge"),
          variant: "destructive",
        });
        return;
      }
      
      setBankSlipFile(file);
    }
  };

  const handleViewDetails = (dateString: string) => {
    const date = parseISO(dateString);
    setDateFilter({ from: date, to: date });
    setGroupByDate(false);
  };

  const fetchDepositReports = async (deposit: BankDeposit) => {
    if (!deposit.deposit_reports || deposit.deposit_reports.length === 0) {
      setDepositReports([]);
      return;
    }

    setLoadingReports(true);
    try {
      // Fetch all reports for this deposit
      const allReports = await financialService.getDailyReports();
      const depositReportIds = deposit.deposit_reports.map(dr => dr.report_id);
      const relatedReports = allReports.filter(report => depositReportIds.includes(report.id));
      setDepositReports(relatedReports);
    } catch (error) {
      console.error('Error fetching deposit reports:', error);
      setDepositReports([]);
      toast({
        title: "Error",
        description: t("messages.errorLoading"),
        variant: "destructive",
      });
    } finally {
      setLoadingReports(false);
    }
  };

  const handleDepositRowClick = (deposit: BankDeposit) => {
    if (deposit.deposit_slip_url) {
      try {
        const newWindow = window.open(deposit.deposit_slip_url, '_blank', 'noopener,noreferrer');
        
        // Check if popup was blocked
        if (newWindow && !newWindow.closed) {
          // Window opened successfully
        } else {
          // Fallback: create a temporary link and click it
          const link = document.createElement('a');
          link.href = deposit.deposit_slip_url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (error) {
        console.error('❌ Error opening URL:', error);
        toast({
          title: "Error Opening Bank Slip",
          description: t("messages.errorOpeningBankSlip"),
          variant: "destructive",
        });
      }
    } else {
      setSelectedDeposit(deposit);
      setShowDepositDetails(true);
      fetchDepositReports(deposit);
    }
  };

  // Filter reports for display based on selected bank
  const getFilteredReports = () => {
    if (newDeposit.bank_name === "Caixa Angola") {
      return undepositedReports.filter(
        (report) => !isAgasekeVehicle(report.vehicles?.plate)
      );
    }
    return undepositedReports;
  };

  // Clear selected AGASEKE reports if switching to Caixa Angola
  useEffect(() => {
    if (newDeposit.bank_name === "Caixa Angola") {
      setSelectedReports((prev) =>
        prev.filter((reportId) => {
          const report = undepositedReports.find((r) => r.id === reportId);
          return report && !isAgasekeVehicle(report.vehicles?.plate);
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newDeposit.bank_name, undepositedReports]);

  // Helper to get net balance for a deposit (array of report_ids)
  const getDepositNetBalance = (deposit: BankDeposit) => {
    if (!deposit.deposit_reports) return 0;
    return deposit.deposit_reports.reduce((sum, dr) => {
      const report = allReports.find(r => r.id === dr.report_id);
      return sum + (report ? calculateNetBalance(report) : 0);
    }, 0);
  };

  // Helper to get net balance for a group of deposits (for grouped by date view)
  const getGroupNetBalance = (group: any) => {
    // group.deposits is an array of BankDeposit
    return group.deposits.reduce((sum, deposit) => sum + getDepositNetBalance(deposit), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header with New Deposit Button and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Banknote className="h-6 w-6" />
            {t("bankDeposits.title")}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{filteredDeposits.length} {t("bankDeposits.deposits")}</Badge>
            {bankFilter !== "all" && (
              <Badge variant="secondary">{bankFilter}</Badge>
            )}
          </div>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <Button className="bg-black hover:bg-gray-800 text-white">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    {t("bankDeposits.logNewDeposit")}
                </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-6xl h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t("bankDeposits.newDepositTitle")}</DialogTitle>
                    <DialogDescription>
                        {t("bankDeposits.newDepositDescription")}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 py-4 flex-1 overflow-hidden">
                  {/* Form Inputs - Left Column */}
                  <div className="lg:col-span-2 space-y-4">
                                          <div className="space-y-2">
                          <Label htmlFor="bank_name">{t("form.bankName")}</Label>
                          <Select name="bank_name" value={newDeposit.bank_name} onValueChange={(value) => handleSelectChange("bank_name", value)}>
                                                             <SelectTrigger>
                                   <SelectValue placeholder={t("form.selectBank")} />
                               </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Caixa Angola">Caixa Angola</SelectItem>
                                <SelectItem value="BAI">BAI</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                                          <div className="space-y-2">
                          <Label htmlFor="deposit_date">{t("form.depositDate")}</Label>
                          <Input 
                            id="deposit_date" 
                            name="deposit_date" 
                            type="date" 
                            value={newDeposit.deposit_date} 
                            onChange={handleInputChange}
                          />
                          {selectedReports.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              📅 {t("form.autoSetToLatestDate")} ({format(parseISO(newDeposit.deposit_date), "MMM dd, yyyy")})
                            </p>
                          )}
                      </div>
                                          <div className="space-y-2">
                          <Label htmlFor="amount">{t("form.totalAmount")}</Label>
                          <Input id="amount" name="amount" type="number" value={newDeposit.amount} readOnly className="font-bold bg-gray-100" />
                      </div>
                    
                                          {/* Bank Slip Upload */}
                      <div className="space-y-2">
                        <Label htmlFor="bank_slip">{t("form.bankSlipAttachment")}</Label>
                        <div className="space-y-2">
                          <Input
                            id="bank_slip"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleFileChange}
                            className="cursor-pointer"
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("form.uploadBankSlip")}
                          </p>
                        {bankSlipFile && (
                          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                            <Paperclip className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-700 truncate">{bankSlipFile.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setBankSlipFile(null)}
                              className="ml-auto h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              ×
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Available Reports - Right Column */}
                  <div className="lg:col-span-3 space-y-2 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between">
                      <Label>{t("form.availableReports")}</Label>
                      <div className="text-xs text-muted-foreground">
                        {undepositedReports.length} {t("form.reportsAvailable")}
                      </div>
                    </div>
                    <ScrollArea className="flex-1 w-full rounded-md border">
                        <div className="p-2 sm:p-4">
                            {groupReportsByDate(getFilteredReports()).length > 0 ? (
                                groupReportsByDate(getFilteredReports()).map((dateGroup) => {
                                    const hasDepositableReports = dateGroup.depositableReports.length > 0;
                                    const isDateSelected = selectedDates.includes(dateGroup.date);
                                    const isDateExpanded = expandedDates.includes(dateGroup.date);
                                    const totalNetBalance = dateGroup.depositableReports.reduce((sum, report) => sum + calculateNetBalance(report), 0);

                                    return (
                                        <div key={dateGroup.date} className={cn(
                                            "mb-4 border rounded-lg overflow-hidden",
                                            hasDepositableReports ? "border-gray-200" : "border-gray-100 opacity-60"
                                        )}>
                                            {/* Date Header */}
                                            <div className={cn(
                                                "p-2 sm:p-3 transition-colors flex items-center justify-between",
                                                isDateSelected ? "bg-blue-50 border-b border-blue-200" : "bg-gray-50 border-b"
                                            )}>
                                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                                    {/* Expand/Collapse Button */}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 hover:bg-gray-200"
                                                        onClick={() => handleDateExpansion(dateGroup.date)}
                                                    >
                                                        {isDateExpanded ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                    
                                                    {/* Date Selection Checkbox */}
                                                    <Checkbox
                                                        checked={isDateSelected}
                                                        disabled={!hasDepositableReports}
                                                        onCheckedChange={() => hasDepositableReports && handleDateSelection(dateGroup.date)}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-medium text-sm">
                                                            <span className="hidden sm:inline">{format(parseISO(dateGroup.date), "EEEE, MMMM dd, yyyy")}</span>
                                                            <span className="sm:hidden">{format(parseISO(dateGroup.date), "EEE, dd MMM")}</span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {dateGroup.depositableReports.length} depositable reports
                                                            {dateGroup.reports.length !== dateGroup.depositableReports.length && 
                                                                ` (${dateGroup.reports.length - dateGroup.depositableReports.length} with losses)`
                                                            }
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <div className={cn(
                                                        "font-semibold text-sm",
                                                        totalNetBalance > 0 ? "text-green-600" : "text-red-500"
                                                    )}>
                                                        <span className="hidden sm:inline">{formatCurrency(totalNetBalance)}</span>
                                                        <span className="sm:hidden text-xs">{formatCurrency(totalNetBalance).replace('AOA ', '')}</span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground hidden sm:block">
                                                        Total for date
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Individual Reports - Show when expanded */}
                                            {isDateExpanded && (
                                                <div className="divide-y divide-gray-100">
                                                    {dateGroup.reports.map((report) => {
                                        const netBalance = calculateNetBalance(report);
                                        const isDepositable = netBalance > 0;
                                                        const isAlreadyDeposited = report.deposit_reports && report.deposit_reports.length > 0;
                                                        const isReportSelected = selectedReports.includes(report.id);
                                                        const isAgaseke = isAgasekeVehicle(report.vehicles?.plate);
                                                        // Disable if Caixa Angola and AGASEKE
                                                        const isCaixaAngola = newDeposit.bank_name === "Caixa Angola";
                                                        const canSelect = isDepositable && !isAlreadyDeposited && !(isCaixaAngola && isAgaseke);

                                        return (
                                                            <div 
                                              key={report.id} 
                                              className={cn(
                                                                    "p-2 sm:p-3 flex items-center gap-2 sm:gap-3 ml-4 sm:ml-6 transition-colors",
                                                                    !canSelect && "text-muted-foreground bg-muted/20",
                                                                    isReportSelected && "bg-blue-100 border-l-4 border-blue-500",
                                                                    canSelect && "hover:bg-gray-50 cursor-pointer"
                                              )}
                                            >
                                                    <TooltipProvider>
                                                      <Tooltip delayDuration={200}>
                                                        <TooltipTrigger asChild>
                                                          <span>
                                                            <Checkbox
                                                              checked={isReportSelected}
                                                              disabled={!canSelect}
                                                              onCheckedChange={(checked) => {
                                                                if (canSelect) {
                                                                  handleReportSelection(report.id);
                                                                }
                                                              }}
                                                            />
                                                          </span>
                                                        </TooltipTrigger>
                                                        {isCaixaAngola && isAgaseke && (
                                                          <TooltipContent side="right">
                                                            AGASEKE vehicles cannot be deposited in Caixa Angola. Please use Standard Bank.
                                                          </TooltipContent>
                                                        )}
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                                <div 
                                                                    className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 items-start sm:items-center"
                                                                    onClick={() => {
                                                                        if (canSelect) {
                                                                            handleReportSelection(report.id);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div>
                                                                        <div className="font-medium text-sm">{report.vehicles?.plate}</div>
                                                    {report.route && (
                                                                            <div className="text-xs text-muted-foreground">{report.route}</div>
                                                    )}
                                                  </div>
                                                                    <div className="text-sm">
                                                                        <span className="sm:hidden text-xs text-muted-foreground">Date: </span>
                                                                        {format(parseISO(report.report_date), "EEE, dd/MM")}
                                                                    </div>
                                                                    <div className="sm:text-right">
                                                                        <div className={cn(
                                                                            "font-medium text-sm",
                                                      isDepositable ? "text-green-600" : "text-red-500"
                                                    )}>
                                                                            <span className="sm:hidden text-xs text-muted-foreground">Net: </span>
                                                      {formatCurrency(netBalance)}
                                                                        </div>
                                                    {!isDepositable && (
                                                                            <div className="text-xs text-red-500">{t("form.loss")}</div>
                                                                        )}
                                                                        {isAlreadyDeposited && (
                                                                            <div className="text-xs text-blue-500">Already deposited</div>
                                                    )}
                                                                        {!canSelect && (
                                                                            <div className="text-xs text-gray-500">
                                                                                {isCaixaAngola && isAgaseke ? "Not depositable in Caixa Angola" : (!isDepositable ? "Loss report" : "Already deposited")}
                                                  </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })
                                ) : (
                                <div className="text-center py-8">
                                            <div className="flex flex-col items-center gap-2">
                                              <span className="text-muted-foreground">{t("form.noReportsAvailable")}</span>
                                              <span className="text-xs text-muted-foreground">{t("form.allReportsDeposited")}</span>
                                            </div>
                                </div>
                                )}
                        </div>
                    </ScrollArea>
                                          {selectedReports.length > 0 && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                            <span className="text-blue-700">
                              📋 {selectedReports.length === 1 ? t("form.reportSelected", { count: selectedReports.length }) : t("form.reportsSelected", { count: selectedReports.length })}
                            </span>
                            <span className="font-medium text-blue-800">
                              {t("table.total")}: {formatCurrency(newDeposit.amount)}
                            </span>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
                <DialogFooter className="flex-shrink-0">
                    <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
                            {t("buttons.cancel")}
                        </Button>
                        <Button 
                            onClick={handleSubmit} 
                            disabled={isSubmitting || selectedReports.length === 0 || !bankSlipFile} 
                            className="bg-black hover:bg-gray-800 text-white w-full sm:w-auto"
                        >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t("buttons.logDeposit")}
                    </Button>
                    </div>
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
                {t("filters.individualDeposits")}
              </Button>
            </div>

            {/* Bank Filter */}
            <div className="flex items-center gap-2">
              <Label>{t("filters.bank")}:</Label>
              <Select value={bankFilter} onValueChange={setBankFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allBanks")}</SelectItem>
                  <SelectItem value="Caixa Angola">Caixa Angola</SelectItem>
                  <SelectItem value="BAI">BAI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter({ from: new Date(), to: new Date() });
                setBankFilter("all");
              }}
            >
              {t("filters.today")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter({ from: undefined, to: undefined });
                setBankFilter("all");
              }}
            >
              {t("filters.clearFilters")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deposits Table */}
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
                  <TableHead>{t("table.banks")}</TableHead>
                  <TableHead>{t("table.deposits")}</TableHead>
                  <TableHead>{t("table.reportsCovered")}</TableHead>
                  <TableHead>{t("table.netBalance")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((group) => (
                  <TableRow key={group.date}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {format(parseISO(group.date), "PPP")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          {group.banks.join(", ")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{group.depositCount} {t("table.deposits")}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{group.reportCount} {t("table.reports")}</span>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(getGroupNetBalance(group))}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(group.date)}
                      >
                        {t("table.viewDetails")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            // Individual Deposits View
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.depositDate")}</TableHead>
                  <TableHead>{t("table.bank")}</TableHead>
                  <TableHead>{t("table.reportsCovered")}</TableHead>
                  <TableHead className="text-right">{t("table.netBalance")}</TableHead>
                  <TableHead className="w-[50px] text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeposits.length > 0 ? (
                  filteredDeposits.map((deposit) => (
                    <TableRow
                      key={deposit.id}
                      onClick={(e: React.MouseEvent<HTMLTableRowElement>) => {
                        // Prevent row click from firing when a button inside the row is clicked
                        if ((e.target as HTMLElement).closest('button')) {
                          return;
                        }
                        handleDepositRowClick(deposit);
                      }}
                      className={cn(
                        deposit.deposit_slip_url && "cursor-pointer hover:bg-muted/50"
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {format(parseISO(deposit.deposit_date), "MMM dd, yyyy")}
                          {deposit.deposit_slip_url && (
                            <Badge variant="secondary" className="text-xs">
                              <Paperclip className="h-3 w-3 mr-1" />
                              {t("table.slipAttached")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{deposit.bank_name}</Badge>
                      </TableCell>
                      <TableCell>{deposit.deposit_reports?.length || 0}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(getDepositNetBalance(deposit))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(deposit);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete Deposit</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                      No bank deposits found for the selected date range.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the bank deposit
              and its associated bank slip from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedDeposit && (
        <Dialog open={showDepositDetails} onOpenChange={setShowDepositDetails}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Deposit Details</DialogTitle>
              <DialogDescription>
                View comprehensive information about the deposit.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              {/* Deposit Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input id="bank_name" name="bank_name" type="text" value={selectedDeposit.bank_name} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deposit_date">Deposit Date</Label>
                  <Input id="deposit_date" name="deposit_date" type="text" value={format(parseISO(selectedDeposit.deposit_date), "MMM dd, yyyy")} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" name="amount" type="text" value={formatCurrency(selectedDeposit.amount)} readOnly />
                </div>
              </div>
              {/* Reports Covered */}
              <div className="space-y-2">
                <Label>Reports Covered</Label>
                <ScrollArea className="h-72 w-full rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depositReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>{format(parseISO(report.report_date), "MMM dd, yyyy")}</TableCell>
                          <TableCell>{report.vehicles?.plate}</TableCell>
                          <TableCell className="text-right">{formatCurrency(calculateNetBalance(report))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              {selectedDeposit?.deposit_slip_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(selectedDeposit.deposit_slip_url, '_blank', 'noopener,noreferrer')}
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  View Bank Slip
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowDepositDetails(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 