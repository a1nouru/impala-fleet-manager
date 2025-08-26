"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
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
  Loader2, 
  PlusCircle, 
  Calculator,
  DollarSign,
  Users,
  TrendingDown,
  FileText,
  Check,
  Eye,
  EyeOff,
  Trash2,
  CalendarIcon
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { hrService, PayrollRun, PayrollDeduction } from "@/services/hrService";

// Helper to format currency
const formatCurrency = (value: number) => {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "AOA",
  });
};

export default function PayrollPage() {
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payrollDeductions, setPayrollDeductions] = useState<PayrollDeduction[]>([]);
  const [selectedPayrollRun, setSelectedPayrollRun] = useState<PayrollRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Dialog states
  const [newPayrollDialogOpen, setNewPayrollDialogOpen] = useState(false);
  const [viewPayrollDialogOpen, setViewPayrollDialogOpen] = useState(false);
  const [finalizeConfirmationOpen, setFinalizeConfirmationOpen] = useState(false);
  const [payrollToFinalize, setPayrollToFinalize] = useState<PayrollRun | null>(null);
  const [finalizePassword, setFinalizePassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [payrollToDelete, setPayrollToDelete] = useState<PayrollRun | null>(null);

  // Date filter states
  const [dateFilter, setDateFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Form states
  const [newPayroll, setNewPayroll] = useState({
    payroll_month: new Date().getMonth() + 1,
    payroll_year: new Date().getFullYear(),
  });

  const fetchPayrollRuns = async () => {
    try {
      setIsLoading(true);
      const payrollRunsData = await hrService.getPayrollRuns();
      setPayrollRuns(payrollRunsData);
    } catch (error) {
      console.error("Error fetching payroll runs:", error);
      toast({
        title: "❌ Error",
        description: "Failed to load payroll runs.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPayrollDeductions = async (payrollRunId: string) => {
    try {
      const deductionsData = await hrService.getPayrollDeductions(payrollRunId);
      setPayrollDeductions(deductionsData);
    } catch (error) {
      console.error("Error fetching payroll deductions:", error);
      toast({
        title: "❌ Error",
        description: "Failed to load payroll deductions.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchPayrollRuns();
  }, []);

  // Form handlers
  const handleInputChange = (field: string, value: string | number) => {
    setNewPayroll(prev => ({ 
      ...prev, 
      [field]: Number(value) || 0
    }));
  };

  const resetForm = () => {
    setNewPayroll({
      payroll_month: new Date().getMonth() + 1,
      payroll_year: new Date().getFullYear(),
    });
  };

  const handleCreatePayroll = async () => {
    if (newPayroll.payroll_month < 1 || newPayroll.payroll_month > 12) {
      toast({
        title: "❌ Validation Error",
        description: "Please select a valid month.",
        variant: "destructive",
      });
      return;
    }

    if (newPayroll.payroll_year < 2020 || newPayroll.payroll_year > 2030) {
      toast({
        title: "❌ Validation Error",
        description: "Please enter a valid year.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payrollRun = await hrService.createPayrollRun({
        payroll_month: newPayroll.payroll_month,
        payroll_year: newPayroll.payroll_year,
        created_by: "Admin" // You might want to get this from auth context
      });

      toast({
        title: "✅ Success",
        description: "Payroll run created successfully. Now processing deductions...",
      });

      // Process deductions
      setIsProcessing(true);
      await hrService.processPayrollDeductions(payrollRun.id);
      
      toast({
        title: "✅ Processing Complete",
        description: "Payroll deductions have been calculated and applied.",
      });

      setNewPayrollDialogOpen(false);
      resetForm();
      fetchPayrollRuns(); // Refresh data
    } catch (error: any) {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to create payroll run.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsProcessing(false);
    }
  };

  const handleViewPayroll = async (payrollRun: PayrollRun) => {
    setSelectedPayrollRun(payrollRun);
    await fetchPayrollDeductions(payrollRun.id);
    setViewPayrollDialogOpen(true);
  };

  const handleFinalizeClick = (payrollRun: PayrollRun) => {
    setViewPayrollDialogOpen(false); // Close the payroll details dialog
    setPayrollToFinalize(payrollRun);
    setFinalizeConfirmationOpen(true);
  };

  const handleFinalizeConfirm = async () => {
    console.log("🔄 handleFinalizeConfirm called");
    console.log("📋 Payroll to finalize:", payrollToFinalize);
    console.log("🔑 Password entered:", finalizePassword);
    
    if (!payrollToFinalize) {
      console.log("❌ No payroll to finalize");
      return;
    }
    
    // Clear any previous password errors
    setPasswordError("");
    
    // Validate password
    if (!finalizePassword) {
      console.log("❌ Password is empty");
      setPasswordError("Please enter the admin password to finalize payroll.");
      toast({
        title: "❌ Password Required",
        description: "Please enter the admin password to finalize payroll.",
        variant: "destructive",
      });
      return;
    }

    // Simple password check (you can modify this to match your security requirements)
    if (finalizePassword.trim() !== "Royal@556") {
      setPasswordError("Incorrect password. Please try again.");
      toast({
        title: "❌ Invalid Password",
        description: "Incorrect password. Please try again.",
        variant: "destructive",
      });
      setFinalizePassword("");
      return;
    }

    console.log("✅ Password correct, proceeding with finalization");
    setIsSubmitting(true);
    try {
      console.log("🚀 Calling hrService.finalizePayrollRun with ID:", payrollToFinalize.id);
      const result = await hrService.finalizePayrollRun(payrollToFinalize.id);
      console.log("✅ Finalization successful:", result);
      
      toast({
        title: "✅ Success",
        description: "Payroll run has been finalized.",
      });
      fetchPayrollRuns(); // Refresh data
    } catch (error) {
      console.error("❌ Finalization error:", error);
      toast({
        title: "❌ Error",
        description: "Failed to finalize payroll run.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setFinalizeConfirmationOpen(false);
      setPayrollToFinalize(null);
      setFinalizePassword("");
      setPasswordError("");
      setShowPassword(false);
    }
  };

  const handleDeleteClick = (payrollRun: PayrollRun) => {
    setPayrollToDelete(payrollRun);
    setDeleteConfirmationOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!payrollToDelete) return;
    setIsSubmitting(true);
    try {
      await hrService.deletePayrollRun(payrollToDelete.id);
      toast({
        title: "✅ Success",
        description: "Payroll run has been deleted.",
      });
      fetchPayrollRuns(); // Refresh data
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to delete payroll run.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmationOpen(false);
      setPayrollToDelete(null);
    }
  };

  const getMonthName = (month: number) => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return months[month - 1];
  };

  // Statistics
  const totalRuns = payrollRuns.length;
  const draftRuns = payrollRuns.filter(run => run.status === 'draft').length;
  const finalizedRuns = payrollRuns.filter(run => run.status === 'finalized').length;
  const currentMonthTotalPayout = payrollRuns
    .filter(run => run.payroll_month === new Date().getMonth() + 1 && run.payroll_year === new Date().getFullYear())
    .reduce((sum, run) => sum + run.total_net_amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Payroll Management
          </h1>
          <Badge variant="outline">{totalRuns} payroll runs</Badge>
        </div>
        
        <Dialog open={newPayrollDialogOpen} onOpenChange={setNewPayrollDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-gray-800 text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              Generate Payroll
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Generate Monthly Payroll</DialogTitle>
              <DialogDescription>
                Create a new payroll run for the specified month and year. This will automatically calculate deductions from vehicle damages.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={newPayroll.payroll_month.toString()} onValueChange={(value) => handleInputChange("payroll_month", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {getMonthName(i + 1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input
                    type="number"
                    min="2020"
                    max="2030"
                    value={newPayroll.payroll_year}
                    onChange={(e) => handleInputChange("payroll_year", e.target.value)}
                  />
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Calculator className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-amber-800 font-medium text-sm">
                      Automatic Deduction Processing
                    </p>
                    <p className="text-amber-700 text-xs mt-1">
                      This will automatically calculate and apply damage deductions (max 30% per employee) based on active vehicle damage entries. Deductions will be subtracted from gross salaries.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewPayrollDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreatePayroll} disabled={isSubmitting || isProcessing} className="bg-black hover:bg-gray-800 text-white">
                {(isSubmitting || isProcessing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessing ? "Processing..." : "Generate Payroll"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              <Label>Filter by Date Range:</Label>
            </div>
            
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

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter({
                  from: startOfMonth(new Date()),
                  to: endOfMonth(new Date()),
                });
              }}
            >
              Reset to Current Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payroll Runs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRuns}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Runs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{draftRuns}</div>
            <p className="text-xs text-muted-foreground">Pending finalization</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalized Runs</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finalizedRuns}</div>
            <p className="text-xs text-muted-foreground">Completed payrolls</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Month Payout</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentMonthTotalPayout)}</div>
            <p className="text-xs text-muted-foreground">{getMonthName(new Date().getMonth() + 1)} {new Date().getFullYear()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Runs Table */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : payrollRuns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Run Date</TableHead>
                  <TableHead className="text-right">Employees</TableHead>
                  <TableHead className="text-right">Gross Amount</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRuns.map((payrollRun) => (
                  <TableRow key={payrollRun.id}>
                    <TableCell className="font-medium">
                      {getMonthName(payrollRun.payroll_month)} {payrollRun.payroll_year}
                    </TableCell>
                    <TableCell>{format(new Date(payrollRun.run_date), "PP")}</TableCell>
                    <TableCell className="text-right">{payrollRun.employees_count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payrollRun.total_gross_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payrollRun.total_deductions)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payrollRun.total_net_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={payrollRun.status === 'finalized' ? "default" : "secondary"}>
                        {payrollRun.status === 'finalized' ? "Finalized" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleViewPayroll(payrollRun)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {payrollRun.status === 'draft' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-blue-600 hover:text-blue-700"
                              onClick={() => handleFinalizeClick(payrollRun)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-red-500 hover:text-red-600"
                              onClick={() => handleDeleteClick(payrollRun)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No payroll runs found</p>
              <p className="text-sm">Generate your first payroll to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Payroll Details Dialog */}
      {selectedPayrollRun && (
        <Dialog open={viewPayrollDialogOpen} onOpenChange={setViewPayrollDialogOpen}>
          <DialogContent className="sm:max-w-7xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Payroll Details - {getMonthName(selectedPayrollRun.payroll_month)} {selectedPayrollRun.payroll_year}
              </DialogTitle>
              <DialogDescription className="text-sm">
                Detailed breakdown of employee salaries and deductions for this payroll run.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto">
              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Employees</p>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xl font-bold">{selectedPayrollRun.employees_count}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Gross</p>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-bold break-all">{formatCurrency(selectedPayrollRun.total_gross_amount)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Deductions</p>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-bold break-all">{formatCurrency(selectedPayrollRun.total_deductions)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Net</p>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-bold text-yellow-600 break-all">{formatCurrency(selectedPayrollRun.total_net_amount)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Employee Details */}
              <div className="max-h-64 sm:max-h-96 overflow-y-auto border rounded-lg">
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Employee</TableHead>
                        <TableHead className="text-right w-[120px]">Gross Salary</TableHead>
                        <TableHead className="text-right w-[120px]">Deductions</TableHead>
                        <TableHead className="text-right w-[120px]">Net Salary</TableHead>
                        <TableHead className="w-[200px]">Deduction Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollDeductions.map((deduction) => (
                        <TableRow key={deduction.id}>
                          <TableCell className="font-medium truncate max-w-[200px]">
                            {deduction.employees?.nome}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(deduction.gross_salary)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(deduction.deduction_amount)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-sm">
                            {formatCurrency(deduction.net_salary)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {deduction.deduction_reason || "No deductions"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell className="text-right font-bold text-sm">
                          {formatCurrency(selectedPayrollRun.total_gross_amount)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm">
                          {formatCurrency(selectedPayrollRun.total_deductions)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm">
                          {formatCurrency(selectedPayrollRun.total_net_amount)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
                
                {/* Mobile View */}
                <div className="sm:hidden space-y-3 p-4">
                  {payrollDeductions.map((deduction) => (
                    <Card key={deduction.id} className="p-4">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm truncate">
                          {deduction.employees?.nome}
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-muted-foreground">Gross</p>
                            <p className="font-medium break-all">
                              {formatCurrency(deduction.gross_salary)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Net</p>
                            <p className="font-bold break-all">
                              {formatCurrency(deduction.net_salary)}
                            </p>
                          </div>
                        </div>
                        {deduction.deduction_amount > 0 && (
                          <div>
                            <p className="text-muted-foreground text-xs">Deduction</p>
                            <p className="font-medium text-xs break-all">
                              {formatCurrency(deduction.deduction_amount)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 break-words">
                              {deduction.deduction_reason || "No deductions"}
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setViewPayrollDialogOpen(false)} className="w-full sm:w-auto">
                Close
              </Button>
              {selectedPayrollRun.status === 'draft' && (
                <Button 
                  onClick={() => handleFinalizeClick(selectedPayrollRun)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Finalize Payroll
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Finalize Confirmation Dialog */}
      <AlertDialog open={finalizeConfirmationOpen} onOpenChange={(open) => {
        if (!open) {
          setFinalizeConfirmationOpen(false);
          setPayrollToFinalize(null);
          setFinalizePassword("");
          setPasswordError("");
          setShowPassword(false);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize Payroll Run?</AlertDialogTitle>
            <AlertDialogDescription>
              {payrollToFinalize && (
                <>
                  Are you sure you want to finalize the payroll for {getMonthName(payrollToFinalize.payroll_month)} {payrollToFinalize.payroll_year}?
                  <br /><br />
                  <strong>This action cannot be undone.</strong> Once finalized, this payroll run cannot be modified.
                  <br /><br />
                  Total net payout: <strong>{formatCurrency(payrollToFinalize.total_net_amount)}</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Label htmlFor="finalize-password" className="text-sm font-medium">
              Admin Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-2">
              <Input
                id="finalize-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter admin password"
                value={finalizePassword}
                onChange={(e) => {
                  setFinalizePassword(e.target.value);
                  // Clear password error when user starts typing
                  if (passwordError) {
                    setPasswordError("");
                  }
                }}
                className={`pr-10 ${passwordError ? "border-red-500" : ""}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && finalizePassword) {
                    handleFinalizeConfirm();
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {passwordError && (
              <p className="text-sm text-red-500 mt-1">{passwordError}</p>
            )}
            {!passwordError && (
              <p className="text-xs text-muted-foreground mt-1">
                Enter the admin password to authorize payroll finalization.
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setFinalizePassword("");
                setPasswordError("");
                setShowPassword(false);
                setFinalizeConfirmationOpen(false);
                setPayrollToFinalize(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                console.log("🔘 Finalize button clicked");
                e.preventDefault();
                handleFinalizeConfirm();
              }} 
              disabled={isSubmitting || !finalizePassword} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Finalize Payroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Run?</AlertDialogTitle>
            <AlertDialogDescription>
              {payrollToDelete && (
                <>
                  Are you sure you want to delete the payroll for {getMonthName(payrollToDelete.payroll_month)} {payrollToDelete.payroll_year}?
                  <br /><br />
                  <strong>This action cannot be undone.</strong> This will permanently delete this payroll run and all associated deduction records.
                  <br /><br />
                  Total payout: <strong>{formatCurrency(payrollToDelete.total_net_amount)}</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Payroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
