"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlusCircle, Edit, CalendarIcon, Filter, Banknote, Paperclip, Eye, Trash2 } from "lucide-react";
import { financialService, BankDeposit, DailyReport } from "@/services/financialService";
import { toast } from "@/components/ui/use-toast";
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

export default function BankDepositsPage() {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState<BankDeposit[]>([]);
  const [undepositedReports, setUndepositedReports] = useState<DailyReport[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
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
        description: "Failed to load page data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
        title: "Validation Error",
        description: "Please fill out all fields and ensure the amount is positive.",
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
        description: "Bank deposit updated successfully.",
      });
      setEditingDeposit(null); // Close dialog
      fetchPageData(); // Refresh all data
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update bank deposit.",
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
        description: "Bank deposit deleted successfully.",
      });
      fetchPageData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete bank deposit.",
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
        title: "Validation Error",
        description: "Please select at least one report to deposit.",
        variant: "destructive",
      });
      return;
    }
    
    if (!bankSlipFile) {
      toast({
        title: "Validation Error",
        description: "Please attach a bank deposit slip.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await financialService.createBankDepositWithFile(newDeposit, selectedReports, bankSlipFile || undefined);
      toast({
        title: "Success",
        description: "Bank deposit created successfully.",
      });
      setDialogOpen(false);
      resetDepositForm();
      fetchPageData(); // Refresh data
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create bank deposit.",
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
          description: "Please upload a PDF or image file (JPG, PNG).",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload a file smaller than 5MB.",
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
        description: "Failed to load report details.",
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
          description: "Could not open the bank slip. Please try clicking 'View Bank Slip' in the deposit details.",
          variant: "destructive",
        });
      }
    } else {
      setSelectedDeposit(deposit);
      setShowDepositDetails(true);
      fetchDepositReports(deposit);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with New Deposit Button and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Banknote className="h-6 w-6" />
            Bank Deposits
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{filteredDeposits.length} deposits</Badge>
            {bankFilter !== "all" && (
              <Badge variant="secondary">{bankFilter}</Badge>
            )}
          </div>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <Button className="bg-black hover:bg-gray-800 text-white">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Log New Deposit
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Log New Bank Deposit</DialogTitle>
                    <DialogDescription>
                        Select the reports to include in this deposit. The total amount will be calculated automatically.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                  {/* Form Inputs */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="bank_name">Bank Name</Label>
                        <Select name="bank_name" value={newDeposit.bank_name} onValueChange={(value) => handleSelectChange("bank_name", value)}>
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
                        <Label htmlFor="deposit_date">Deposit Date</Label>
                        <Input 
                          id="deposit_date" 
                          name="deposit_date" 
                          type="date" 
                          value={newDeposit.deposit_date} 
                          onChange={handleInputChange}
                        />
                        {selectedReports.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            📅 Auto-set to latest report date ({format(parseISO(newDeposit.deposit_date), "MMM dd, yyyy")})
                          </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="amount">Total Amount</Label>
                        <Input id="amount" name="amount" type="number" value={newDeposit.amount} readOnly className="font-bold bg-gray-100" />
                    </div>
                    
                    {/* Bank Slip Upload */}
                    <div className="space-y-2">
                      <Label htmlFor="bank_slip">Bank Slip Attachment</Label>
                      <div className="space-y-2">
                        <Input
                          id="bank_slip"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFileChange}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground">
                          Upload a PDF or image (JPG, PNG) of your bank deposit slip. Max size: 5MB.
                        </p>
                        {bankSlipFile && (
                          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                            <Paperclip className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-700">{bankSlipFile.name}</span>
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
                  {/* Undeposited Reports Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Available Reports</Label>
                      <div className="text-xs text-muted-foreground">
                        {undepositedReports.length} reports available
                      </div>
                    </div>
                    <ScrollArea className="h-72 w-full rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Vehicle</TableHead>
                                    <TableHead className="text-right">Net Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {undepositedReports.length > 0 ? (
                                    undepositedReports.map((report) => {
                                        const netBalance = calculateNetBalance(report);
                                        const isDepositable = netBalance > 0;
                                        const isSelected = selectedReports.includes(report.id);

                                        return (
                                            <TableRow 
                                              key={report.id} 
                                              className={cn(
                                                !isDepositable && "text-muted-foreground bg-muted/30",
                                                isSelected && "bg-blue-50 border-blue-200"
                                              )}
                                            >
                                                <TableCell>
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => {
                                                            if (isDepositable) {
                                                                handleReportSelection(report.id);
                                                            }
                                                        }}
                                                        disabled={!isDepositable}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                  <div className="flex flex-col">
                                                    <span className="font-medium">
                                                      {format(new Date(report.report_date), "dd/MM/yy")}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                      {format(new Date(report.report_date), "EEE")}
                                                    </span>
                                                  </div>
                                                </TableCell>
                                                <TableCell>
                                                  <div className="flex flex-col">
                                                    <span className="font-medium">{report.vehicles?.plate}</span>
                                                    {report.route && (
                                                      <span className="text-xs text-muted-foreground">{report.route}</span>
                                                    )}
                                                  </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                  <div className="flex flex-col items-end">
                                                    <span className={cn(
                                                      "font-medium",
                                                      isDepositable ? "text-green-600" : "text-red-500"
                                                    )}>
                                                      {formatCurrency(netBalance)}
                                                    </span>
                                                    {!isDepositable && (
                                                      <span className="text-xs text-red-500">Loss</span>
                                                    )}
                                                  </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">
                                            <div className="flex flex-col items-center gap-2">
                                              <span className="text-muted-foreground">No reports available for deposit</span>
                                              <span className="text-xs text-muted-foreground">All operational reports have been deposited</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                    {selectedReports.length > 0 && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-blue-700">
                            📋 {selectedReports.length} report{selectedReports.length !== 1 ? 's' : ''} selected
                          </span>
                          <span className="font-medium text-blue-800">
                            Total: {formatCurrency(newDeposit.amount)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-black hover:bg-gray-800 text-white">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Deposit
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
                Individual Deposits
              </Button>
            </div>

            {/* Bank Filter */}
            <div className="flex items-center gap-2">
              <Label>Bank:</Label>
              <Select value={bankFilter} onValueChange={setBankFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Banks</SelectItem>
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
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter({ from: undefined, to: undefined });
                setBankFilter("all");
              }}
            >
              Clear Filters
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
                  <TableHead>Date</TableHead>
                  <TableHead>Banks</TableHead>
                  <TableHead>Deposits</TableHead>
                  <TableHead>Reports Covered</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      <span className="font-medium">{group.depositCount} deposits</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{group.reportCount} reports</span>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(group.totalAmount)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(group.date)}
                      >
                        View Details
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
                  <TableHead>Deposit Date</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Reports Covered</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[50px] text-right">Actions</TableHead>
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
                              Slip Attached
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{deposit.bank_name}</Badge>
                      </TableCell>
                      <TableCell>{deposit.deposit_reports?.length || 0}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(deposit.amount)}
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