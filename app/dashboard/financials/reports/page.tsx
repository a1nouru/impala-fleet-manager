"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, CheckCircle, Clock, Edit, Trash2, PlusCircle, AlertTriangle, Upload, X, Eye } from "lucide-react";
import { financialService, DailyReport, DailyExpense } from "@/services/financialService";
import { toast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
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
import { useTranslation } from "@/hooks/useTranslation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";

// Helper function to calculate net balance
const calculateNetBalance = (report: DailyReport) => {
  const totalRevenue = (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
  const totalExpenses = (report.daily_expenses || []).reduce((sum, expense) => sum + expense.amount, 0);
  return totalRevenue - totalExpenses;
};

// Helper function to calculate total revenue
const calculateTotalRevenue = (report: DailyReport) => {
  return (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
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

export default function AllDailyReportsPage() {
  const { t } = useTranslation('financials');
  const { user } = useAuth();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State for the main edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<DailyReport | null>(null);
  const [editedReportData, setEditedReportData] = useState<Partial<DailyReport>>({});
  
  // State for the individual expense edit dialog
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<DailyExpense | null>(null);
  const [editedExpenseData, setEditedExpenseData] = useState<Partial<DailyExpense>>({});

  // State for adding a new expense
  const [newExpenseData, setNewExpenseData] = useState<Partial<DailyExpense>>({ category: "", description: "", amount: 0 });
  const [selectedExpenseType, setSelectedExpenseType] = useState<string>("");
  const [customExpenseType, setCustomExpenseType] = useState<string>("");

  // State for fuel receipt uploads
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [currentReceiptUrl, setCurrentReceiptUrl] = useState<string>("");
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  const handleEditClick = (report: DailyReport) => {
    setEditingReport(report);
    setEditedReportData({
        status: report.status,
        non_operational_reason: report.non_operational_reason,
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

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const reportsData = await financialService.getDailyReports();
      setReports(reportsData);
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

  

  // Handlers for expenses
  const handleEditExpenseClick = (expense: DailyExpense) => {
    setEditingExpense(expense);
    setEditedExpenseData({
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      receipt_url: expense.receipt_url
    });
    
    // Set the expense type for editing
    const categoryLower = expense.category.toLowerCase();
    if (["fuel", "subsidy"].includes(categoryLower)) {
      const capitalizedCategory = expense.category.charAt(0).toUpperCase() + expense.category.slice(1).toLowerCase();
      setSelectedExpenseType(capitalizedCategory);
      setCustomExpenseType("");
      
      // Set receipt URL for fuel expenses
      if (categoryLower === "fuel") {
        setCurrentReceiptUrl(expense.receipt_url || "");
      }
    } else {
      setSelectedExpenseType("Other");
      setCustomExpenseType(expense.category);
    }
    
    // Reset file state
    setReceiptFile(null);
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
    console.log("Expense type changed to:", value); // Debug log
    setSelectedExpenseType(value);
    if (value === "Fuel") {
      if (editingExpense) {
        setEditedExpenseData(prev => ({ ...prev, category: "Fuel" }));
      } else {
        setNewExpenseData(prev => ({ ...prev, category: "Fuel" }));
      }
      setCustomExpenseType("");
    } else if (value === "Subsidy") {
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
    
    // Reset receipt upload state when type changes
    if (value !== "Fuel") {
      setReceiptFile(null);
      setCurrentReceiptUrl("");
    }
  };

  // Receipt upload handlers
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "❌ Invalid File Type",
          description: "Please upload PDF, JPG, or PNG files only.",
          variant: "destructive",
        });
        return;
      }
      
      if (file.size > maxSize) {
        toast({
          title: "❌ File Too Large",
          description: "Maximum file size is 5MB.",
          variant: "destructive",
        });
        return;
      }
      
      setReceiptFile(file);
    }
  };

  const removeReceiptFile = () => {
    setReceiptFile(null);
  };

  const removeCurrentReceipt = () => {
    setCurrentReceiptUrl("");
    if (editingExpense) {
      setEditedExpenseData(prev => ({ ...prev, receipt_url: "" }));
    } else {
      setNewExpenseData(prev => ({ ...prev, receipt_url: "" }));
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
        let receiptUrl = "";
        
        // Upload receipt if it's a fuel expense and file is selected
        if (selectedExpenseType === "Fuel" && receiptFile && user?.id) {
          setIsUploadingReceipt(true);
          try {
            receiptUrl = await financialService.uploadFuelReceipt(receiptFile, user.id);
          } catch (uploadError) {
            console.error("Receipt upload failed:", uploadError);
            toast({
              title: "⚠️ Receipt Upload Failed",
              description: "Expense will be created without receipt. You can add it later.",
              variant: "destructive",
            });
          } finally {
            setIsUploadingReceipt(false);
          }
        }

        const expenseData = {
          ...newExpenseData,
          receipt_url: receiptUrl
        };

        await financialService.createDailyExpense({ report_id: editingReport.id, ...expenseData } as DailyExpense);
        toast({ title: "✅ Success", description: "Expense added successfully." });
        
        // Reset form
        setNewExpenseData({ category: "", description: "", amount: 0 });
        setSelectedExpenseType("");
        setCustomExpenseType("");
        setReceiptFile(null);
        setCurrentReceiptUrl("");
        
        // Refresh the main report being edited to show the new expense
        const updatedReport = await financialService.getDailyReportById(editingReport.id);
        if (updatedReport) setEditingReport(updatedReport);
    } catch (error) {
        toast({ title: "❌ Error", description: "Failed to add expense.", variant: "destructive" });
    }
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense) return;
    
    try {
        let finalExpenseData = { ...editedExpenseData };
        
        // Handle receipt upload/update for fuel expenses
        if (selectedExpenseType === "Fuel") {
          if (receiptFile && user?.id) {
            setIsUploadingReceipt(true);
            try {
              // Delete old receipt if exists
              if (editingExpense.receipt_url) {
                await financialService.deleteFuelReceipt(editingExpense.receipt_url);
              }
              // Upload new receipt
              const receiptUrl = await financialService.uploadFuelReceipt(receiptFile, user.id);
              finalExpenseData.receipt_url = receiptUrl;
            } catch (uploadError) {
              console.error("Receipt upload failed:", uploadError);
              toast({
                title: "⚠️ Receipt Upload Failed",
                description: "Expense will be updated without new receipt.",
                variant: "destructive",
              });
            } finally {
              setIsUploadingReceipt(false);
            }
          } else if (currentReceiptUrl === "" && editingExpense.receipt_url) {
            // Receipt was removed
            try {
              await financialService.deleteFuelReceipt(editingExpense.receipt_url);
              finalExpenseData.receipt_url = "";
            } catch (deleteError) {
              console.error("Receipt deletion failed:", deleteError);
            }
          }
        }

        await financialService.updateDailyExpense(editingExpense.id, finalExpenseData);
        toast({ title: "✅ Success", description: "Expense updated successfully." });
        setIsExpenseDialogOpen(false);
        
        // Reset receipt state
        setReceiptFile(null);
        setCurrentReceiptUrl("");
        
        // Refresh the main report to reflect changes
        if(editingReport) {
            const updatedReport = await financialService.getDailyReportById(editingReport.id);
            if (updatedReport) setEditingReport(updatedReport);
        }
    } catch (error) {
        toast({ title: "❌ Error", description: "Failed to update expense.", variant: "destructive" });
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
        try {
            await financialService.deleteDailyExpense(expenseId);
            toast({ title: "Success", description: "Expense deleted." });
            // Refresh the main report
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
       <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText />
              All Daily Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Vehicle</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Revenue</TableHead>
                            <TableHead>Expenses</TableHead>
                            <TableHead>Net Balance</TableHead>
                            <TableHead>Deposit Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reports.map((report) => {
                            const netBalance = calculateNetBalance(report);
                            const totalRevenue = calculateTotalRevenue(report);
                            const totalExpenses = (report.daily_expenses || []).reduce((sum, expense) => sum + expense.amount, 0);
                            const isDeposited = report.deposit_reports && report.deposit_reports.length > 0;
                            const isFlagged = isReportFlagged(report);
                            const flaggingReason = isFlagged ? getFlaggingReason(report) : '';

                            return (
                                <TableRow key={report.id} className={isFlagged ? "bg-red-100" : ""}>
                                    <TableCell>{format(new Date(report.report_date), "PPP")}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <span>{report.vehicles?.plate || "N/A"}</span>
                                        {isFlagged && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <AlertTriangle className="h-4 w-4 text-amber-500 cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>⚠️ {t("flaggedReports.flagReason")}: {flaggingReason}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={report.status === "Operational" ? "default" : "destructive"}>
                                            {report.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatCurrency(totalRevenue)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {formatCurrency(totalExpenses)}
                                                                                         {(!report.daily_expenses || report.daily_expenses.length === 0) && (
                                                 <div className="w-2 h-2 bg-red-500 rounded-full" title={t("expenses.noExpensesIndicator")}></div>
                                             )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{formatCurrency(netBalance)}</TableCell>
                                    <TableCell>
                                        <Badge variant={isDeposited ? "secondary" : "outline"} className="flex items-center gap-1">
                                            {isDeposited ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                            {isDeposited ? "Deposited" : "Pending"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              onClick={() => handleEditClick(report)}
                                              className="h-8 w-8 p-0"
                                            >
                                              <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              onClick={() => handleDeleteReport(report.id, report.vehicles?.plate || 'Unknown')}
                                              className="h-8 w-8 p-0 hover:bg-red-50"
                                            >
                                              <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
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
                            Editing report for vehicle {editingReport.vehicles?.plate} on {format(new Date(editingReport.report_date), "PPP")}
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
                           </div>
                           {/* Expense List */}
                           <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                {editingReport.daily_expenses && editingReport.daily_expenses.map(expense => (
                                    <div key={expense.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                        <div>
                                            <div className="font-medium flex items-center gap-2">
                                                <span>{expense.category}:</span>
                                                <span className="text-muted-foreground">{formatCurrency(expense.amount)}</span>
                                                {/* Receipt indicator for fuel expenses */}
                                                {expense.category.toLowerCase() === "fuel" && expense.receipt_url && (
                                                  <Tooltip>
                                                    <TooltipTrigger>
                                                      <div 
                                                        className="flex items-center gap-1 cursor-pointer text-blue-600 hover:text-blue-800"
                                                        onClick={() => window.open(expense.receipt_url, '_blank')}
                                                      >
                                                        <FileText className="h-4 w-4" />
                                                        <span className="text-xs">{t("expenses.receiptIndicator")}</span>
                                                      </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p>{t("expenses.clickToViewReceipt")}</p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditExpenseClick(expense)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteExpense(expense.id)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                           </div>
                           {/* Add New Expense Form */}
                           <div className="mt-4 p-4 border-t">
                               <h5 className="font-medium mb-3">Add New Expense</h5>
                               <div className="space-y-3">
                                   <div className="space-y-2">
                                       <Label>{t("expenses.expenseType")}</Label>
                                       <Select 
                                         value={selectedExpenseType} 
                                         onValueChange={handleExpenseTypeChange}
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
                                           onChange={handleCustomExpenseTypeChange}
                                           className="mt-2"
                                         />
                                       )}
                                   </div>
                                   <div className="space-y-2">
                                       <Label>Amount</Label>
                                       <Input name="amount" type="number" value={newExpenseData.amount} onChange={handleExpenseInputChange} />
                                   </div>
                                   <div className="space-y-2">
                                       <Label>Description</Label>
                                       <Input name="description" value={newExpenseData.description || ""} onChange={handleExpenseInputChange} />
                                   </div>
                                   
                                   {/* Fuel Receipt Upload Section for New Expense */}
                                   {selectedExpenseType === "Fuel" && (
                                     <div className="space-y-2">
                                       <Label>{t("expenses.fuelReceipt")}</Label>
                                       <div className="space-y-2">
                                         {/* New File Selected */}
                                         {receiptFile && (
                                           <div className="flex items-center justify-between p-2 bg-blue-50 rounded-md border border-blue-200">
                                             <div className="flex items-center gap-2">
                                               <Upload className="h-4 w-4 text-blue-500" />
                                               <span className="text-sm text-blue-700">{receiptFile.name}</span>
                                             </div>
                                             <Button
                                               variant="ghost"
                                               size="sm"
                                               onClick={removeReceiptFile}
                                               className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                             >
                                               <X className="h-4 w-4" />
                                             </Button>
                                           </div>
                                         )}
                                         
                                         {/* File Upload Input */}
                                         <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                                           <input
                                             type="file"
                                             accept=".pdf,.jpg,.jpeg,.png"
                                             onChange={handleReceiptFileChange}
                                             className="hidden"
                                             id="receipt-upload-new"
                                           />
                                           <label htmlFor="receipt-upload-new" className="cursor-pointer">
                                             <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                                             <p className="text-sm text-gray-600">
                                               {receiptFile ? t("expenses.replaceReceipt") : t("expenses.uploadFuelReceipt")}
                                             </p>
                                             <p className="text-xs text-gray-400 mt-1">{t("expenses.receiptFileFormats")}</p>
                                           </label>
                                         </div>
                                       </div>
                                     </div>
                                   )}
                                   
                                   <Button onClick={handleAddNewExpense} size="sm" className="w-full" disabled={isUploadingReceipt}>
                                       {isUploadingReceipt ? (
                                         <>
                                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                           Uploading...
                                         </>
                                       ) : (
                                         "Add Expense"
                                       )}
                                   </Button>
                               </div>
                           </div>
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
                          onValueChange={handleExpenseTypeChange}
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
                            onChange={handleCustomExpenseTypeChange}
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
                    
                    {/* Fuel Receipt Upload Section */}
                    {selectedExpenseType === "Fuel" && (
                      <div className="space-y-2">
                        <Label>{t("expenses.fuelReceipt")}</Label>
                        <div className="space-y-2">
                          {/* Current Receipt Display */}
                          {currentReceiptUrl && !receiptFile && (
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md border">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-500" />
                                                                               <span className="text-sm text-gray-700">{t("expenses.currentReceipt")}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(currentReceiptUrl, '_blank')}
                                  className="h-7 w-7 p-0"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={removeCurrentReceipt}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {/* New File Selected */}
                          {receiptFile && (
                            <div className="flex items-center justify-between p-2 bg-blue-50 rounded-md border border-blue-200">
                              <div className="flex items-center gap-2">
                                <Upload className="h-4 w-4 text-blue-500" />
                                <span className="text-sm text-blue-700">{receiptFile.name}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={removeReceiptFile}
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          
                          {/* File Upload Input */}
                          {(!currentReceiptUrl || receiptFile) && (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleReceiptFileChange}
                                className="hidden"
                                id="receipt-upload-edit"
                              />
                                                                             <label htmlFor="receipt-upload-edit" className="cursor-pointer">
                                                 <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                                                 <p className="text-sm text-gray-600">
                                                   {receiptFile ? t("expenses.replaceReceipt") : t("expenses.uploadFuelReceipt")}
                                                 </p>
                                                 <p className="text-xs text-gray-400 mt-1">{t("expenses.receiptFileFormats")}</p>
                                               </label>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpdateExpense} disabled={isUploadingReceipt}>
                      {isUploadingReceipt ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        "Save Expense"
                      )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
} 