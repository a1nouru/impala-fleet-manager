"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { openStoredFile, signStoredUrls } from "@/lib/storage-url";
import { extractSlips } from "@/lib/bank-slip/client";
import { verifySlips, type CompanyExpenseLine, type ExtractedSlip, type ReportLine, type SlipVerification } from "@/lib/bank-slip/verify";
import { SlipVerificationPanel, type SlipExtractionStatus } from "@/components/slip-verification-panel";
import { SlipVerificationDetail, type DetailReport } from "@/components/slip-verification-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlusCircle, Edit, CalendarIcon, Filter, Banknote, Paperclip, Eye, Trash2, ChevronDown, ChevronRight, Edit3, CheckCircle2, XCircle } from "lucide-react";
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
import { format, isToday, parseISO, isWithinInterval, startOfDay, endOfDay, addDays } from "date-fns";
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
import { REGULAR_CASH_ACCOUNT, REGULAR_TPA_ACCOUNT } from "@/lib/constants";

// Common expense categories for exclude filter
const EXPENSE_CATEGORIES = [
  { value: "Fuel", label: "⛽ Fuel", icon: "⛽" },
  { value: "Subsidy", label: "💰 Subsidy", icon: "💰" },
  { value: "Maintenance", label: "🔧 Maintenance", icon: "🔧" },
  { value: "Tolls", label: "🛣️ Tolls", icon: "🛣️" },
  { value: "Parking", label: "🅿️ Parking", icon: "🅿️" },
  { value: "Driver Payment", label: "👤 Driver Payment", icon: "👤" },
] as const;

// Helper function to calculate total revenue
const calculateNetBalance = (report: DailyReport, excludedCategories: string[] = []) => {
  const totalRevenue = (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
  const totalExpenses = (report.daily_expenses || [])
    .filter(expense => !excludedCategories.includes(expense.category))
    .reduce((sum, expense) => sum + expense.amount, 0);
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
const groupReportsByDate = (reports: DailyReport[], excludedCategories: string[] = []) => {
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
    totalAmount: reports.reduce((sum, report) => sum + calculateNetBalance(report, excludedCategories), 0),
    depositableReports: reports.filter(report => {
      const netBalance = calculateNetBalance(report, excludedCategories);
      const isDepositable = netBalance > 0;
      // Since reports come from getUndepositedReports(), they're already filtered to exclude deposited ones
      return isDepositable;
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
  
  // State for the edit dialog
  const [editingDeposit, setEditingDeposit] = useState<BankDeposit | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSelectedReports, setEditSelectedReports] = useState<string[]>([]);
  const [editAvailableReports, setEditAvailableReports] = useState<DailyReport[]>([]);
  const [editCurrentSlips, setEditCurrentSlips] = useState<any[]>([]);
  
  // State for adding more slips to existing deposits
  const [addSlipsDeposit, setAddSlipsDeposit] = useState<BankDeposit | null>(null);
  const [addSlipsDialogOpen, setAddSlipsDialogOpen] = useState(false);
  const [additionalSlipFiles, setAdditionalSlipFiles] = useState<File[]>([]);

  // Filter states
  const [dateFilter, setDateFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(),
    to: new Date(),
  });
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [excludeFilter, setExcludeFilter] = useState<string[]>([]);
  const [groupByDate, setGroupByDate] = useState(true);

  // State for creating new deposits
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [bankSlipFiles, setBankSlipFiles] = useState<File[]>([]);
  const [newDeposit, setNewDeposit] = useState({
    bank_name: "Caixa Angola" as "Caixa Angola" | "BAI" | "Standard Bank",
    deposit_date: format(new Date(), "yyyy-MM-dd"),
    amount: 0,
  });

  // Add state for all reports
  const [allReports, setAllReports] = useState<DailyReport[]>([]);

  // Slip OCR verification state (read-only — the accountant can see the
  // extracted amounts but never edit them)
  const [slipStatus, setSlipStatus] = useState<SlipExtractionStatus>("idle");
  const [slipError, setSlipError] = useState<string | null>(null);
  const [extractedSlips, setExtractedSlips] = useState<ExtractedSlip[]>([]);
  const slipFilesKeyRef = useRef<string>("");
  // Company expenses recorded around the deposit date: candidates the
  // accountant may explicitly tick to explain a gap (never auto-applied).
  const [d1Expenses, setD1Expenses] = useState<CompanyExpenseLine[]>([]);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  // Right-pane focus view on the selected reports once verification ran
  const [focusSelected, setFocusSelected] = useState(false);

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
        title: t("messages.error"),
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
      return sum + (report ? calculateNetBalance(report, excludeFilter) : 0);
    }, 0);
    setNewDeposit((prev) => ({ ...prev, amount: total }));
  }, [selectedReports, undepositedReports, excludeFilter]);

  // Read attached slips with the extraction service whenever the file set
  // changes. Keyed by name+size so re-renders don't re-trigger calls; debounced
  // so attaching several files in a row costs one extraction.
  useEffect(() => {
    const key = bankSlipFiles.map((f) => `${f.name}:${f.size}`).join("|");
    if (key === slipFilesKeyRef.current) return;
    slipFilesKeyRef.current = key;

    if (bankSlipFiles.length === 0) {
      setSlipStatus("idle");
      setSlipError(null);
      setExtractedSlips([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSlipStatus("extracting");
      setSlipError(null);
      try {
        const slips = await extractSlips(bankSlipFiles, controller.signal);
        setExtractedSlips(slips);
        setSlipStatus("done");
      } catch (error) {
        if (controller.signal.aborted) return;
        setExtractedSlips([]);
        setSlipStatus("error");
        setSlipError(error instanceof Error ? error.message : String(error));
      }
    }, 1200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [bankSlipFiles]);

  // Load the deposit date's company expenses whenever it changes (only
  // relevant while slips are being verified).
  useEffect(() => {
    setSelectedExpenseIds([]);
    if (!newDeposit.deposit_date) {
      setD1Expenses([]);
      return;
    }
    let cancelled = false;
    // Deposit date + the day after: cash is banked D+1, so the expenses paid
    // out of the takings can carry either date depending on convention.
    const nextDay = format(addDays(parseISO(newDeposit.deposit_date), 1), "yyyy-MM-dd");
    financialService
      .getCompanyExpensesForDates([newDeposit.deposit_date, nextDay])
      .then((expenses) => {
        if (cancelled) return;
        setD1Expenses(
          expenses.map((e) => ({
            id: e.id,
            amount: e.amount,
            description: e.description || null,
            category: e.category || null,
            expenseDate: e.expense_date,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setD1Expenses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [newDeposit.deposit_date]);

  // Deterministic comparison of extracted slips vs the selected reports'
  // per-vehicle net balances. Recomputes locally on any selection change —
  // no further extraction calls needed.
  const slipVerification: SlipVerification | null = useMemo(() => {
    if (slipStatus !== "done" || selectedReports.length === 0) return null;
    const lines: ReportLine[] = selectedReports.flatMap((reportId) => {
      const report = undepositedReports.find((r) => r.id === reportId);
      if (!report) return [];
      return [{
        reportId,
        plate: report.vehicles?.plate || reportId.slice(0, 8),
        reportDate: format(parseISO(report.report_date), "yyyy-MM-dd"),
        netBalance: calculateNetBalance(report, excludeFilter),
      }];
    });
    const chosenExpenses = d1Expenses.filter((e) => selectedExpenseIds.includes(e.id));
    return verifySlips(lines, extractedSlips, newDeposit.amount, chosenExpenses, {
      expectedGroup: "regular",
      regularAccounts: [REGULAR_CASH_ACCOUNT, REGULAR_TPA_ACCOUNT],
    });
  }, [slipStatus, extractedSlips, selectedReports, undepositedReports, excludeFilter, newDeposit.amount, d1Expenses, selectedExpenseIds]);

  // Selected reports flattened for the right-pane focus view.
  const selectedReportDetails: DetailReport[] = useMemo(() => {
    return selectedReports.flatMap((reportId) => {
      const report = undepositedReports.find((r) => r.id === reportId);
      if (!report) return [];
      const split = report as DailyReport & { cash_revenue?: number; tpa_revenue?: number };
      return [{
        reportId,
        plate: report.vehicles?.plate || reportId.slice(0, 8),
        reportDate: format(parseISO(report.report_date), "yyyy-MM-dd"),
        ticketRevenue: report.ticket_revenue || 0,
        cashRevenue: typeof split.cash_revenue === "number" ? split.cash_revenue : null,
        tpaRevenue: typeof split.tpa_revenue === "number" ? split.tpa_revenue : null,
        otherRevenue: (report.baggage_revenue || 0) + (report.cargo_revenue || 0),
        expenses: (report.daily_expenses || [])
          .filter((e) => !excludeFilter.includes(e.category))
          .reduce((sum, e) => sum + e.amount, 0),
        netBalance: calculateNetBalance(report, excludeFilter),
      }];
    });
  }, [selectedReports, undepositedReports, excludeFilter]);

  // Jump to the focus view as soon as a verification verdict lands; drop
  // back to the list when the selection empties.
  useEffect(() => {
    if (slipStatus === "done" && selectedReports.length > 0) setFocusSelected(true);
    if (selectedReports.length === 0) setFocusSelected(false);
  }, [slipStatus, selectedReports.length]);

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
    const groupedReports = groupReportsByDate(getFilteredReports(), excludeFilter);
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
    const groupedReports = groupReportsByDate(getFilteredReports(), excludeFilter);
    const newSelectedDates: string[] = [];
    
    groupedReports.forEach(group => {
      const dateReportIds = group.depositableReports.map(report => report.id);
      const isFullDateSelected = dateReportIds.length > 0 && dateReportIds.every(id => selectedReports.includes(id));
      
      if (isFullDateSelected) {
        newSelectedDates.push(group.date);
      }
    });
    
    setSelectedDates(newSelectedDates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReports, undepositedReports, excludeFilter]);
  
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
        title: t("messages.success"),
        description: t("messages.depositUpdated"),
      });
      setEditingDeposit(null); // Close dialog
      fetchPageData(); // Refresh all data
    } catch (error) {
      toast({
        title: t("messages.error"),
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
        title: t("messages.success"),
        description: t("messages.depositDeleted"),
      });
      fetchPageData();
    } catch (error) {
      toast({
        title: t("messages.error"),
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
        title: t("messages.validationError"),
        description: t("messages.selectAtLeastOneReport"),
        variant: "destructive",
      });
      return;
    }
    
    if (bankSlipFiles.length === 0) {
      toast({
        title: t("messages.validationError"),
        description: t("messages.attachBankSlip"),
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
        bankSlipFiles,
        slipVerification,
        "regular"
      );

      toast({
        title: t("messages.success"),
        description: t("messages.depositCreatedWithDetails", { amount: formatCurrency(newDeposit.amount), count: selectedReports.length }),
      });

      // Reset form and refresh data
      resetDepositForm();
      setDialogOpen(false);
      await fetchPageData();
    } catch (error) {
      console.error("❌ Error creating deposit:", error);
      toast({
        title: t("messages.error"),
        description: t("messages.errorCreating"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetDepositForm = () => {
    setVehicleType("regular");
    setNewDeposit({
      bank_name: "Caixa Angola",
      deposit_date: format(new Date(), "yyyy-MM-dd"),
      amount: 0,
    });
    setSelectedReports([]);
    setSelectedDates([]);
    setExpandedDates([]);
    setBankSlipFiles([]);
    setSlipStatus("idle");
    setSlipError(null);
    setExtractedSlips([]);
    setSelectedExpenseIds([]);
    setFocusSelected(false);
    slipFilesKeyRef.current = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      // Validate all files
      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          toast({
            title: t("messages.validationError"),
            description: t("messages.invalidFileTypeNamed", { name: file.name }),
            variant: "destructive",
          });
          return;
        }
        
        if (file.size > maxSize) {
          toast({
            title: t("messages.validationError"),
            description: t("messages.fileTooLargeNamed", { name: file.name }),
            variant: "destructive",
          });
          return;
        }
      }
      
      // Add files to existing ones (allow multiple uploads)
      setBankSlipFiles(prev => [...prev, ...files]);
    }
  };

  const removeSlipFile = (index: number) => {
    setBankSlipFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeAdditionalSlipFile = (index: number) => {
    setAdditionalSlipFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAdditionalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      // Validate all files
      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          toast({
            title: t("messages.validationError"),
            description: t("messages.invalidFileTypeNamed", { name: file.name }),
            variant: "destructive",
          });
          return;
        }
        
        if (file.size > maxSize) {
          toast({
            title: t("messages.validationError"),
            description: t("messages.fileTooLargeNamed", { name: file.name }),
            variant: "destructive",
          });
          return;
        }
      }
      
      // Add files to existing ones
      setAdditionalSlipFiles(prev => [...prev, ...files]);
    }
  };

  const handleAddSlipsToDeposit = async () => {
    if (!addSlipsDeposit || additionalSlipFiles.length === 0) {
      toast({
        title: t("messages.validationError"),
        description: t("messages.selectAtLeastOneFile"),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      await financialService.addSlipsToDeposit(addSlipsDeposit.id, additionalSlipFiles);
      
      toast({
        title: t("messages.success"),
        description: t("messages.slipsAdded", { count: additionalSlipFiles.length }),
      });

      // Reset and close dialog
      setAdditionalSlipFiles([]);
      setAddSlipsDialogOpen(false);
      setAddSlipsDeposit(null);
      
      // Refresh data
      await fetchPageData();
    } catch (error) {
      console.error("❌ Error adding slips:", error);
      toast({
        title: t("messages.error"),
        description: t("messages.errorAddingSlips"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddSlipsDialog = (deposit: BankDeposit) => {
    setAddSlipsDeposit(deposit);
    setAdditionalSlipFiles([]);
    setAddSlipsDialogOpen(true);
  };

  const handleOpenEditDialog = async (deposit: BankDeposit) => {
    try {
      setEditingDeposit(deposit);
      
      // Fetch available reports for this deposit
      const availableReports = await financialService.getReportsForEditingDeposit(deposit.id);
      setEditAvailableReports(availableReports);
      
      // Set currently selected reports
      const currentReportIds = deposit.deposit_reports?.map(dr => dr.report_id) || [];
      setEditSelectedReports(currentReportIds);
      
      // Set current slips (using new system only)
      const slips = deposit.bank_deposit_slips || [];
      const currentSlips = slips.map(slip => ({
        id: slip.id,
        url: slip.slip_url,
        name: slip.file_name || 'Bank Slip',
        isLegacy: false
      }));
      
      setEditCurrentSlips(currentSlips);
      setEditDialogOpen(true);
    } catch (error) {
      console.error('Error opening edit dialog:', error);
      toast({
        title: t("messages.error"),
        description: t("messages.errorLoading"),
        variant: "destructive",
      });
    }
  };

  const handleEditReportSelection = (reportId: string) => {
    setEditSelectedReports((prev) =>
      prev.includes(reportId)
        ? prev.filter((id) => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleUpdateDeposit = async () => {
    if (!editingDeposit) return;
    
    if (editSelectedReports.length === 0) {
      toast({
        title: t("messages.validationError"),
        description: t("messages.selectAtLeastOneReport"),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Calculate new amount based on selected reports
      const newAmount = editSelectedReports.reduce((sum, reportId) => {
        const report = editAvailableReports.find((r) => r.id === reportId);
        return sum + (report ? calculateNetBalance(report, excludeFilter) : 0);
      }, 0);

      const updateData = {
        bank_name: editingDeposit.bank_name,
        deposit_date: editingDeposit.deposit_date,
        amount: newAmount,
      };

      await financialService.updateBankDeposit(
        editingDeposit.id,
        updateData,
        editSelectedReports
      );

      toast({
        title: t("messages.success"),
        description: t("messages.depositUpdatedWithReports", { count: editSelectedReports.length }),
      });

      // Reset and close dialog
      setEditDialogOpen(false);
      setEditingDeposit(null);
      setEditSelectedReports([]);
      setEditAvailableReports([]);
      
      // Refresh data
      await fetchPageData();
    } catch (error) {
      console.error("❌ Error updating deposit:", error);
      toast({
        title: t("messages.error"),
        description: t("messages.errorUpdating"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditInputChange = (field: keyof BankDeposit, value: any) => {
    if (!editingDeposit) return;
    setEditingDeposit(prev => prev ? ({ ...prev, [field]: value }) : null);
  };

  const handleRemoveSlipFromEdit = async (slipIndex: number) => {
    const slipToRemove = editCurrentSlips[slipIndex];
    
    if (!slipToRemove) return;

    try {
      // Delete from database
      await financialService.deleteBankSlip(slipToRemove.id);

      // Remove from local state
      setEditCurrentSlips(prev => prev.filter((_, index) => index !== slipIndex));
      
      toast({
        title: t("messages.success"),
        description: t("messages.slipRemoved"),
      });
    } catch (error) {
      console.error('Error removing slip:', error);
      toast({
        title: t("messages.error"),
        description: t("messages.errorRemovingSlip"),
        variant: "destructive",
      });
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
        title: t("messages.error"),
        description: t("messages.errorLoading"),
        variant: "destructive",
      });
    } finally {
      setLoadingReports(false);
    }
  };

  const handleDepositRowClick = async (deposit: BankDeposit) => {
    // Use the new slip system only (legacy URLs should be migrated)
    const slips = deposit.bank_deposit_slips || [];
    // Buckets are private: mint fresh signed URLs before opening tabs.
    const slipUrls = (await signStoredUrls(slips.map(slip => slip.slip_url))).filter(Boolean) as string[];

    console.log('🔍 Deposit click debug:', {
      depositId: deposit.id,
      totalSlips: slips.length,
      validSlipUrls: slipUrls.length,
      slips: slips,
      slipUrls: slipUrls
    });

    if (slipUrls.length > 0) {
      try {
        console.log(`📄 Attempting to open ${slipUrls.length} slip(s) in separate tabs`);
        
        // For better browser compatibility, open the first tab immediately
        if (slipUrls.length > 0) {
          const firstWindow = window.open(slipUrls[0], '_blank', 'noopener,noreferrer');
          if (!firstWindow || firstWindow.closed) {
            console.warn('⚠️ First popup was blocked, using fallback method');
            const link = document.createElement('a');
            link.href = slipUrls[0];
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }
        
        // Open remaining slips with delay if there are more than one
        if (slipUrls.length > 1) {
          slipUrls.slice(1).forEach((url, index) => {
            setTimeout(() => {
              try {
                console.log(`📄 Opening slip ${index + 2} of ${slipUrls.length}: ${url}`);
                const newWindow = window.open(url, `_blank_${index + 1}`, 'noopener,noreferrer');
                
                // Fallback if popup was blocked
                if (!newWindow || newWindow.closed) {
                  console.warn(`⚠️ Popup ${index + 2} was blocked, using fallback method`);
                  const link = document.createElement('a');
                  link.href = url;
                  link.target = '_blank';
                  link.rel = 'noopener noreferrer';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }
              } catch (error) {
                console.error(`❌ Error opening URL ${index + 2}:`, url, error);
              }
            }, (index + 1) * 150); // Increased delay for better browser compatibility
          });
        }
        
        // Show success message
        toast({
          title: `✅ Opening ${slipUrls.length} slip(s)`,
          description: `Opening ${slipUrls.length} bank slip${slipUrls.length > 1 ? 's' : ''} in new tabs`,
        });
      } catch (error) {
        console.error('❌ Error opening bank slips:', error);
        toast({
          title: t("messages.error"),
          description: t("messages.errorOpeningBankSlip"),
          variant: "destructive",
        });
      }
    } else {
      console.log('📄 No slips found, opening deposit details modal');
      setSelectedDeposit(deposit);
      setShowDepositDetails(true);
      fetchDepositReports(deposit);
    }
  };

  const getFilteredReports = () => undepositedReports;

  // Helper to get net balance for a deposit (array of report_ids)
  const getDepositNetBalance = (deposit: BankDeposit) => {
    if (!deposit.deposit_reports) return 0;
    return deposit.deposit_reports.reduce((sum, dr) => {
      const report = allReports.find(r => r.id === dr.report_id);
      return sum + (report ? calculateNetBalance(report, excludeFilter) : 0);
    }, 0);
  };

  // Helper to get net balance for a group of deposits (for grouped by date view)
  const getGroupNetBalance = (group: any) => {
    // group.deposits is an array of BankDeposit
    return group.deposits.reduce((sum: number, deposit: BankDeposit) => sum + getDepositNetBalance(deposit), 0);
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
            {excludeFilter.length > 0 && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                {t("filters.excludingCategories", { count: excludeFilter.length })}
              </Badge>
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
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleFileChange}
                            className="cursor-pointer"
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("form.uploadMultipleBankSlips")}
                          </p>
                        {bankSlipFiles.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-700">
                              {t("slipVerification.filesSelected", { count: bankSlipFiles.length })}
                            </div>
                            {bankSlipFiles.map((file, index) => (
                              <div key={index} className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                                <Paperclip className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-700 truncate flex-1">{file.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSlipFile(index)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 flex-shrink-0"
                                >
                                  ×
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <SlipVerificationPanel
                          status={slipStatus}
                          error={slipError}
                          slips={extractedSlips}
                          verification={slipVerification}
                          candidateExpenses={d1Expenses}
                          selectedExpenseIds={selectedExpenseIds}
                          onToggleExpense={(id) =>
                            setSelectedExpenseIds((prev) =>
                              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                  {/* Available Reports - Right Column */}
                  <div className="lg:col-span-3 space-y-2 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between">
                      <Label>{focusSelected ? t("slipVerification.selectedReportsDetail") : t("form.availableReports")}</Label>
                      <div className="flex items-center gap-2">
                        {selectedReports.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setFocusSelected((v) => !v)}
                          >
                            {focusSelected
                              ? t("slipVerification.backToList")
                              : t("slipVerification.viewSelectedDetail", { count: selectedReports.length })}
                          </Button>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {getFilteredReports().length} {t("form.reportsAvailable")}
                        </div>
                      </div>
                    </div>
                    {focusSelected && selectedReports.length > 0 ? (
                      <ScrollArea className="flex-1 w-full rounded-md border">
                        <SlipVerificationDetail
                          reports={selectedReportDetails}
                          slips={extractedSlips}
                          verification={slipVerification}
                        />
                      </ScrollArea>
                    ) : (
                    <ScrollArea className="flex-1 w-full rounded-md border">
                        <div className="p-2 sm:p-4">
                            {groupReportsByDate(getFilteredReports(), excludeFilter).length > 0 ? (
                                groupReportsByDate(getFilteredReports(), excludeFilter).map((dateGroup) => {
                                    const hasDepositableReports = dateGroup.depositableReports.length > 0;
                                    const isDateSelected = selectedDates.includes(dateGroup.date);
                                    const isDateExpanded = expandedDates.includes(dateGroup.date);
                                    const totalNetBalance = dateGroup.depositableReports.reduce((sum, report) => sum + calculateNetBalance(report, excludeFilter), 0);

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
                                                            {t("form.depositableReports", { count: dateGroup.depositableReports.length })}
                                                            {dateGroup.reports.length !== dateGroup.depositableReports.length &&
                                                                ` (${t("form.withLosses", { count: dateGroup.reports.length - dateGroup.depositableReports.length })})`
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
                                                        {t("form.totalForDate")}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Individual Reports - Show when expanded */}
                                            {isDateExpanded && (
                                                <div className="divide-y divide-gray-100">
                                                    {dateGroup.reports.map((report) => {
                                        const netBalance = calculateNetBalance(report, excludeFilter);
                                        const isDepositable = netBalance > 0;
                                                        const isAlreadyDeposited = report.deposit_reports && report.deposit_reports.length > 0;
                                                        const isReportSelected = selectedReports.includes(report.id);
                                                        const canSelect = isDepositable && !isAlreadyDeposited;

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
                                                                            <div className="text-xs text-blue-500">{t("form.alreadyDeposited")}</div>
                                                    )}
                                                                        {!canSelect && (
                                                                            <div className="text-xs text-gray-500">
                                                                                {!isDepositable ? t("form.lossReport") : t("form.alreadyDeposited")}
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
                    )}
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
                            disabled={isSubmitting || selectedReports.length === 0 || bankSlipFiles.length === 0 || slipStatus === "extracting" || (slipVerification !== null && slipVerification.status === "unverified")} 
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

            {/* Exclude Filter */}
            <div className="flex items-center gap-2">
              <Label>Exclude:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-between text-left font-normal",
                      excludeFilter.length === 0 && "text-muted-foreground"
                    )}
                  >
                    {excludeFilter.length === 0 
                      ? "Select expenses to exclude..." 
                      : excludeFilter.length === 1 
                        ? EXPENSE_CATEGORIES.find(cat => cat.value === excludeFilter[0])?.label || excludeFilter[0]
                        : `${excludeFilter.length} categories excluded`
                    }
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <div className="p-3">
                    <div className="space-y-2">
                      {EXPENSE_CATEGORIES.map((category) => (
                        <div key={category.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={category.value}
                            checked={excludeFilter.includes(category.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setExcludeFilter(prev => [...prev, category.value]);
                              } else {
                                setExcludeFilter(prev => prev.filter(item => item !== category.value));
                              }
                            }}
                          />
                          <Label
                            htmlFor={category.value}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {category.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {excludeFilter.length > 0 && (
                      <div className="pt-3 border-t mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExcludeFilter([])}
                          className="w-full text-xs"
                        >
                          Clear All
                        </Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Clear Filters */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter({ from: new Date(), to: new Date() });
                setBankFilter("all");
                setExcludeFilter([]);
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
                setExcludeFilter([]);
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
                        // Show cursor pointer if deposit has slips
                        (deposit.bank_deposit_slips && deposit.bank_deposit_slips.length > 0) && "cursor-pointer hover:bg-muted/50"
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {format(parseISO(deposit.deposit_date), "MMM dd, yyyy")}
                          {(() => {
                            // Use new slip system only (legacy URLs migrated)
                            const slips = deposit.bank_deposit_slips || [];
                            const slipCount = slips.length;
                              
                            if (slipCount > 0) {
                              return (
                                <Badge variant="secondary" className="text-xs">
                                  <Paperclip className="h-3 w-3 mr-1" />
                                  {slipCount > 1 ? t("table.slipsAttachedCount", { count: slipCount }) : t("table.slipAttached")}
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                          {deposit.slip_verification && (() => {
                            const sv = deposit.slip_verification;
                            const status = sv.status ?? (sv.totalsMatch ? "verified" : "unverified");
                            if (status === "verified") {
                              return (
                                <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {t("slipVerification.badgeMatched")}
                                </Badge>
                              );
                            }
                            if (status === "verified_with_expenses") {
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge className="text-xs bg-teal-100 text-teal-800 hover:bg-teal-100 cursor-help">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        {t("slipVerification.badgeMatchedWithExpenses")}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p>{t("slipVerification.tooltipWithExpenses", { amount: formatCurrency(sv.d1ExpensesTotal ?? 0) })}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }
                            const residual = sv.residual ?? (sv.selectedTotal - sv.slipsTotal);
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="text-xs bg-red-100 text-red-800 hover:bg-red-100 cursor-help">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      {t("slipVerification.badgeUnverified")}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p>
                                      {(sv.wrongAccountSlipIndexes ?? []).length > 0
                                        ? t("slipVerification.wrongAccountNote", { count: sv.wrongAccountSlipIndexes.length })
                                        : residual > 0
                                          ? t("slipVerification.residualShort", { amount: formatCurrency(residual) })
                                          : t("slipVerification.residualExcess", { amount: formatCurrency(Math.abs(residual)) })}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="secondary">{deposit.bank_name}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>{deposit.deposit_reports?.length || 0}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(getDepositNetBalance(deposit))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* View Slips Button - only show if deposit has slips */}
                          {(() => {
                            const slips = deposit.bank_deposit_slips || [];
                            const slipCount = slips.length;
                            
                            if (slipCount > 0) {
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDepositRowClick(deposit);
                                        }}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>View {slipCount} bank slip{slipCount > 1 ? 's' : ''}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }
                            return null;
                          })()}
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-black hover:text-gray-800"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditDialog(deposit);
                                  }}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("bankDeposits.editDepositTooltip")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-black hover:text-gray-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAddSlipsDialog(deposit);
                                  }}
                                >
                                  <PlusCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("bankDeposits.addMoreSlipsTooltip")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
                                <p>{t("bankDeposits.deleteDepositTooltip")}</p>
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
            <AlertDialogTitle>{t("bankDeposits.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bankDeposits.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("bankDeposits.deleteConfirmButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add More Slips Dialog */}
      <Dialog open={addSlipsDialogOpen} onOpenChange={setAddSlipsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("bankDeposits.addMoreSlips")}</DialogTitle>
            <DialogDescription>
              {t("bankDeposits.addMoreSlipsDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="additional_slips">{t("bankDeposits.selectAdditionalSlips")}</Label>
              <Input
                id="additional_slips"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleAdditionalFileChange}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                {t("bankDeposits.uploadAdditionalSlips")}
              </p>
            </div>
            
            {additionalSlipFiles.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">
                  {additionalSlipFiles.length} {t("bankDeposits.slipsAttached")}
                </div>
                {additionalSlipFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                    <Paperclip className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700 truncate flex-1">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAdditionalSlipFile(index)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 flex-shrink-0"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setAddSlipsDialogOpen(false)}>
              {t("buttons.cancel")}
            </Button>
            <Button 
              onClick={handleAddSlipsToDeposit} 
              disabled={isSubmitting || additionalSlipFiles.length === 0}
              className="bg-black hover:bg-gray-800 text-white"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("bankDeposits.addSlips")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Deposit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-6xl h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
                     <DialogHeader>
             <DialogTitle>{t("bankDeposits.editDeposit")}</DialogTitle>
             <DialogDescription>
               {t("bankDeposits.editDepositDescription")}
             </DialogDescription>
           </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 py-4 flex-1 overflow-hidden">
                         {/* Form Inputs - Left Column */}
             <div className="lg:col-span-2 space-y-4">
               <div className="space-y-2">
                 <Label htmlFor="edit_bank_name">Bank Name</Label>
                 <Select 
                   value={editingDeposit?.bank_name} 
                   onValueChange={(value) => handleEditInputChange('bank_name', value)}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Select a bank" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="Caixa Angola">Caixa Angola</SelectItem>
                     <SelectItem value="BAI">BAI</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               
               <div className="space-y-2">
                 <Label htmlFor="edit_deposit_date">Deposit Date</Label>
                 <Input 
                   id="edit_deposit_date" 
                   type="date" 
                   value={editingDeposit?.deposit_date || ''} 
                   onChange={(e) => handleEditInputChange('deposit_date', e.target.value)}
                 />
               </div>
               
               <div className="space-y-2">
                 <Label htmlFor="edit_amount">Total Amount</Label>
                 <Input 
                   id="edit_amount" 
                   type="number" 
                   value={editSelectedReports.reduce((sum, reportId) => {
                     const report = editAvailableReports.find((r) => r.id === reportId);
                     return sum + (report ? calculateNetBalance(report, excludeFilter) : 0);
                   }, 0)} 
                   readOnly 
                   className="font-bold bg-gray-100" 
                 />
               </div>

               {/* Current Bank Slips */}
               <div className="space-y-2">
                 <Label>{t("bankDeposits.currentBankSlips")}</Label>
                 {editCurrentSlips.length > 0 ? (
                   <div className="space-y-2">
                     <div className="text-sm font-medium text-gray-700">
                       {editCurrentSlips.length} {t("bankDeposits.slipsAttached")}
                     </div>
                     {editCurrentSlips.map((slip, index) => (
                       <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                         <Paperclip className="h-4 w-4 text-blue-600" />
                         <span className="text-sm text-blue-700 truncate flex-1">{slip.name}</span>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleRemoveSlipFromEdit(index)}
                           className="h-6 w-6 p-0 text-red-500 hover:text-red-700 flex-shrink-0"
                         >
                           ×
                         </Button>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="text-sm text-muted-foreground">{t("bankDeposits.noSlipsAttached")}</div>
                 )}
               </div>
             </div>
            
            {/* Available Reports - Right Column */}
            <div className="lg:col-span-3 space-y-2 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between">
                <Label>{t("form.availableReports")}</Label>
                <Badge variant="outline">
                  {editAvailableReports.length} {t("form.reportsAvailable")}
                </Badge>
              </div>
              
              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-2 space-y-2">
                  {editAvailableReports.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{t("form.noReportsAvailable")}</p>
                  ) : (
                    editAvailableReports.map((report) => {
                      const netBalance = calculateNetBalance(report, excludeFilter);
                      const isSelected = editSelectedReports.includes(report.id);
                      
                      return (
                        <div
                          key={report.id}
                          className={cn(
                            "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors",
                            isSelected ? "bg-blue-50 border-blue-200" : "bg-white hover:bg-gray-50"
                          )}
                          onClick={() => handleEditReportSelection(report.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox checked={isSelected} onChange={() => {}} />
                            <div>
                              <div className="font-medium">
                                {format(parseISO(report.report_date), "MMM dd, yyyy")} - {report.vehicles?.plate}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {report.route || 'No route specified'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={cn(
                              "font-semibold",
                              netBalance > 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {formatCurrency(netBalance)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t("buttons.cancel")}
            </Button>
                         <Button 
               onClick={handleUpdateDeposit} 
               disabled={isSubmitting || editSelectedReports.length === 0}
               className="bg-black hover:bg-gray-800 text-white"
             >
               {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               {t("bankDeposits.updateDeposit")}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                          <TableCell className="text-right">{formatCurrency(calculateNetBalance(report, excludeFilter))}</TableCell>
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
                  onClick={() => openStoredFile(selectedDeposit.deposit_slip_url)}
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