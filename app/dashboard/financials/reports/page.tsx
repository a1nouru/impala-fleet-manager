"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, CheckCircle, Clock, Edit, Trash2, PlusCircle } from "lucide-react";
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

export default function AllDailyReportsPage() {
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
        toast({ title: "Success", description: "Expense added." });
        setNewExpenseData({ category: "", description: "", amount: 0 });
        // Refresh the main report being edited to show the new expense
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
        // Refresh the main report to reflect changes
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
                            const totalRevenue = (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0);
                            const totalExpenses = (report.daily_expenses || []).reduce((sum, expense) => sum + expense.amount, 0);
                            const isDeposited = report.deposit_reports && report.deposit_reports.length > 0;

                            return (
                                <TableRow key={report.id}>
                                    <TableCell>{format(new Date(report.report_date), "PPP")}</TableCell>
                                    <TableCell>{report.vehicles?.plate || "N/A"}</TableCell>
                                    <TableCell>
                                        <Badge variant={report.status === "Operational" ? "default" : "destructive"}>
                                            {report.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatCurrency(totalRevenue)}</TableCell>
                                    <TableCell>{formatCurrency(totalExpenses)}</TableCell>
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
                                            <p className="font-medium">{expense.category}</p>
                                            <p className="text-sm text-muted-foreground">{formatCurrency(expense.amount)}</p>
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
                           <div className="space-y-2 border-t pt-4">
                               <h5 className="font-medium">Add New Expense</h5>
                               <div className="grid grid-cols-2 gap-2">
                                   <Input name="category" placeholder="Category" value={newExpenseData.category} onChange={handleExpenseInputChange} />
                                   <Input name="amount" type="number" placeholder="Amount" value={newExpenseData.amount} onChange={handleExpenseInputChange} />
                               </div>
                               <Textarea name="description" placeholder="Description (optional)" value={newExpenseData.description} onChange={handleExpenseInputChange} />
                               <Button size="sm" className="w-full" onClick={handleAddNewExpense}>
                                   <PlusCircle className="h-4 w-4 mr-2" />
                                   Add Expense
                               </Button>
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