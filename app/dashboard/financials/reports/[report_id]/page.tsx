"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlusCircle, ArrowLeft } from "lucide-react";
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

// Helper function to calculate total revenue
const calculateTotalRevenue = (report: DailyReport) => {
  return (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
};

// Helper function to calculate total expenses
const calculateTotalExpenses = (expenses: DailyExpense[]) => {
  return expenses.reduce((total, expense) => total + (expense.amount || 0), 0);
};

export default function ReportDetailPage() {
  const { t } = useTranslation('financials');
  const params = useParams();
  const router = useRouter();
  const reportId = params?.report_id as string;

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

  const handleExpenseInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleCustomExpenseTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomExpenseType(value);
    setNewExpense(prev => ({ ...prev, category: value }));
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
      setIsSubmittingExpense(true);
      try {
          const createdExpense = await financialService.createDailyExpense({
              report_id: reportId,
              ...newExpense,
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
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddExpense} disabled={isSubmittingExpense} className="bg-black hover:bg-gray-800 text-white">
                        {isSubmittingExpense && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Expense
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
