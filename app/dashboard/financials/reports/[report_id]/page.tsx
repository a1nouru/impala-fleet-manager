"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlusCircle, ArrowLeft, Upload, X, FileText, Eye } from "lucide-react";
import { financialService, DailyReport, DailyExpense } from "@/services/financialService";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/context/AuthContext";

// Helper function to calculate total revenue
const calculateTotalRevenue = (report: DailyReport) => {
  return (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
};

// Helper function to calculate total expenses
const calculateTotalExpenses = (expenses: DailyExpense[]) => {
  return expenses.reduce((total, expense) => total + (expense.amount || 0), 0);
};

export default function ReportDetailPage({ params }: { params: { report_id: string } }) {
  const { t } = useTranslation('financials');
  const { user } = useAuth();
  const router = useRouter();
  const reportId = params.report_id;

  const [report, setReport] = useState<DailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({
      category: "",
      description: "",
      amount: 0,
  });
  const [selectedExpenseType, setSelectedExpenseType] = useState<string>("");
  const [customExpenseType, setCustomExpenseType] = useState<string>("");

  // State for fuel receipt uploads
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const data = await financialService.getDailyReportById(reportId);
      setReport(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load report details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (reportId) {
      fetchReport();
    }
  }, [reportId]);

  const handleExpenseInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setNewExpense((prev) => ({
          ...prev,
          [name]: name === "amount" ? parseFloat(value) || 0 : value,
      }));
  };

  const handleExpenseTypeChange = (value: string) => {
    setSelectedExpenseType(value);
    if (value !== "Other") {
      setNewExpense(prev => ({ ...prev, category: value }));
      setCustomExpenseType("");
    } else {
      setNewExpense(prev => ({ ...prev, category: "" }));
    }
    
    // Reset receipt upload state when type changes
    if (value !== "Fuel") {
      setReceiptFile(null);
    }
  };

  const handleCustomExpenseTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomExpenseType(value);
    setNewExpense(prev => ({ ...prev, category: value }));
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

  // Validation function for fuel expenses
  const validateFuelExpenseReceipt = (expenseType: string, hasReceiptFile: boolean): { isValid: boolean; message?: string } => {
    if (expenseType === "Fuel") {
      if (!hasReceiptFile) {
        return { 
          isValid: false, 
          message: t("expenses.fuelReceiptRequired") 
        };
      }
    }
    return { isValid: true };
  };

  const handleAddExpense = async () => {
      if (!newExpense.category || newExpense.amount <= 0) {
          toast({
              title: "Validation Error",
              description: "Please provide a valid category and amount.",
              variant: "destructive",
          });
          return;
      }

      // Validate fuel receipt requirement
      const receiptValidation = validateFuelExpenseReceipt(selectedExpenseType, !!receiptFile);
      if (!receiptValidation.isValid) {
          toast({ 
              title: "❌ " + t("expenses.cannotSaveWithoutReceipt"), 
              description: receiptValidation.message || t("expenses.fuelReceiptRequired"), 
              variant: "destructive" 
          });
          return;
      }

      setIsSubmittingExpense(true);
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
            ...newExpense,
            receipt_url: receiptUrl
          };

          const createdExpense = await financialService.createDailyExpense({
              report_id: reportId,
              ...expenseData,
          });
          // Update the report state to include the new expense
          setReport((prevReport) => {
              if (!prevReport) return null;
              return {
                  ...prevReport,
                  daily_expenses: [...prevReport.daily_expenses, createdExpense],
              };
          });
          toast({
              title: "Success",
              description: "Expense added successfully.",
          });
          setIsExpenseDialogOpen(false);
          setNewExpense({ category: "", description: "", amount: 0 }); // Reset form
          setSelectedExpenseType("");
          setCustomExpenseType("");
          setReceiptFile(null);
      } catch (error) {
          toast({
              title: "Error",
              description: "Failed to add expense.",
              variant: "destructive",
          });
      } finally {
          setIsSubmittingExpense(false);
      }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-4 text-lg">Loading Report Details...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Report not found.</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }
  
  const totalRevenue = calculateTotalRevenue(report);
  const totalExpenses = calculateTotalExpenses(report.daily_expenses);
  const netBalance = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/financials')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to All Reports
      </Button>

      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Financial Report for {report.vehicles?.plate} on {format(new Date(report.report_date), "PPP")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-muted-foreground">Total Revenue</h3>
            <p className="text-2xl font-bold">{totalRevenue.toLocaleString("en-US", { style: "currency", currency: "AOA" })}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-muted-foreground">Total Expenses</h3>
            <p className="text-2xl font-bold">{totalExpenses.toLocaleString("en-US", { style: "currency", currency: "AOA" })}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-muted-foreground">Net Balance</h3>
            <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {netBalance.toLocaleString("en-US", { style: "currency", currency: "AOA" })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Expenses</CardTitle>
          <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-black hover:bg-gray-800 text-white">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Expense
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Expense</DialogTitle>
                    <DialogDescription>
                        Enter the details for the new expense for this report.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="expenseType">{t("expenses.expenseType")}</Label>
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
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Input id="description" name="description" value={newExpense.description} onChange={handleExpenseInputChange} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input id="amount" name="amount" type="number" value={newExpense.amount} onChange={handleExpenseInputChange} />
                    </div>
                    
                    {/* Fuel Receipt Upload Section */}
                    {selectedExpenseType === "Fuel" && (
                      <div className="space-y-2">
                        <Label>{t("expenses.fuelReceipt")}</Label>
                        <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded-md border border-orange-200">
                          {t("expenses.receiptAmountNote")}
                        </div>
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
                              id="receipt-upload-detail"
                            />
                            <label htmlFor="receipt-upload-detail" className="cursor-pointer">
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
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>Cancel</Button>
                    <Button 
                      onClick={handleAddExpense} 
                      disabled={isSubmittingExpense || isUploadingReceipt || (selectedExpenseType === "Fuel" && !receiptFile)} 
                      className="bg-black hover:bg-gray-800 text-white"
                    >
                        {(isSubmittingExpense || isUploadingReceipt) ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {isUploadingReceipt ? "Uploading..." : "Saving..."}
                          </>
                        ) : (
                          "Save Expense"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.daily_expenses.length > 0 ? (
                report.daily_expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>{expense.description || "-"}</TableCell>
                    <TableCell className="text-right">
                      {expense.amount.toLocaleString("en-US", { style: "currency", currency: "AOA" })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    No expenses recorded for this report.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
