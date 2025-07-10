"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Filter, CalendarIcon, Receipt, Eye, Edit, Trash2 } from "lucide-react";
import { financialService, DailyReport, DailyExpense } from "@/services/financialService";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
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
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AGASEKE_PLATES, isAgasekeVehicle } from "@/lib/constants";
import { useTranslation } from "@/hooks/useTranslation";

// Extended expense interface with report data
interface ExpenseWithReport extends DailyExpense {
  report: {
    id: string;
    report_date: string;
    vehicle_plate: string;
    route?: string;
  };
}

// Helper to format currency
const formatCurrency = (value: number) => {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "AOA",
  });
};

// Group expenses by date
const groupExpensesByDate = (expenses: ExpenseWithReport[]) => {
  const grouped = expenses.reduce((acc, expense) => {
    const date = format(parseISO(expense.report.report_date), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(expense);
    return acc;
  }, {} as Record<string, ExpenseWithReport[]>);

  return Object.entries(grouped).map(([date, expenses]) => ({
    date,
    expenses,
    totalAmount: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    expenseCount: expenses.length,
    vehicles: [...new Set(expenses.map(e => e.report.vehicle_plate))],
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export default function AllExpensesPage() {
  const { t } = useTranslation('financials');
  const [expenses, setExpenses] = useState<ExpenseWithReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [dateFilter, setDateFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(),
    to: new Date(),
  });
  const [groupByDate, setGroupByDate] = useState(true);
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<string>("all");
  const [reportTypeFilter, setReportTypeFilter] = useState<"all" | "agaseke" | "regular">("all");

  // Dialog states for expense operations
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithReport | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Edit expense states
  const [editedExpenseData, setEditedExpenseData] = useState<{
    category: string;
    description: string;
    amount: number;
  }>({
    category: "",
    description: "",
    amount: 0,
  });
  const [selectedExpenseType, setSelectedExpenseType] = useState<string>("");
  const [customExpenseType, setCustomExpenseType] = useState<string>("");

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      const reportsData = await financialService.getDailyReports();
      
      // Extract all expenses with their report information
      const allExpenses: ExpenseWithReport[] = [];
      reportsData.forEach(report => {
        if (report.daily_expenses && report.daily_expenses.length > 0) {
          report.daily_expenses.forEach(expense => {
            allExpenses.push({
              ...expense,
              report: {
                id: report.id,
                report_date: report.report_date,
                vehicle_plate: report.vehicles?.plate || 'Unknown',
                route: report.route,
              }
            });
          });
        }
      });
      
      setExpenses(allExpenses);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load expenses.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Filter expenses based on selected filters
  const filteredExpenses = expenses.filter(expense => {
    const expenseDate = parseISO(expense.report.report_date);
    
    // Date filter
    let dateMatch = true;
    if (dateFilter.from || dateFilter.to) {
      if (dateFilter.from && dateFilter.to) {
        dateMatch = isWithinInterval(expenseDate, {
          start: startOfDay(dateFilter.from),
          end: endOfDay(dateFilter.to),
        });
      } else if (dateFilter.from) {
        dateMatch = expenseDate >= startOfDay(dateFilter.from);
      } else if (dateFilter.to) {
        dateMatch = expenseDate <= endOfDay(dateFilter.to);
      }
    }
    
    // Expense type filter
    const typeMatch = expenseTypeFilter === "all" || (expense.category && expense.category.toLowerCase() === expenseTypeFilter.toLowerCase());
    
    // Report type filter (agaseke vs regular)
    let reportTypeMatch = true;
    if (reportTypeFilter === "agaseke") {
      reportTypeMatch = isAgasekeVehicle(expense.report.vehicle_plate);
    } else if (reportTypeFilter === "regular") {
      reportTypeMatch = !isAgasekeVehicle(expense.report.vehicle_plate);
    }
    
    return dateMatch && typeMatch && reportTypeMatch;
  });

  // Group or show individual expenses
  const displayData = groupByDate ? groupExpensesByDate(filteredExpenses) : null;

  const handleViewDetails = (dateString: string) => {
    const date = parseISO(dateString);
    setDateFilter({ from: date, to: date });
    setGroupByDate(false);
  };

  // Expense operation handlers
  const handleViewExpense = (expense: ExpenseWithReport) => {
    setSelectedExpense(expense);
    setIsViewDialogOpen(true);
  };

  const handleEditExpense = (expense: ExpenseWithReport) => {
    setSelectedExpense(expense);
    setEditedExpenseData({
      category: expense.category || "",
      description: expense.description || "",
      amount: expense.amount || 0,
    });

    // Set the expense type for editing
    if (["Fuel", "Subsidy"].includes(expense.category || "")) {
      setSelectedExpenseType(expense.category);
      setCustomExpenseType("");
    } else {
      setSelectedExpenseType("Other");
      setCustomExpenseType(expense.category || "");
    }
    setIsEditDialogOpen(true);
  };

  const handleDeleteExpense = (expense: ExpenseWithReport) => {
    setSelectedExpense(expense);
    setIsDeleteDialogOpen(true);
  };

  const handleExpenseInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedExpenseData(prev => ({ 
      ...prev, 
      [name]: name === "amount" ? parseFloat(value) || 0 : value 
    }));
  };

  const handleExpenseTypeChange = (value: string) => {
    setSelectedExpenseType(value);
    if (value !== "Other") {
      setEditedExpenseData(prev => ({ ...prev, category: value }));
      setCustomExpenseType("");
    } else {
      setEditedExpenseData(prev => ({ ...prev, category: customExpenseType }));
    }
  };

  const handleCustomExpenseTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomExpenseType(value);
    setEditedExpenseData(prev => ({ ...prev, category: value }));
  };

  const handleUpdateExpense = async () => {
    if (!selectedExpense || !editedExpenseData.category || !editedExpenseData.amount) {
      toast({
        title: "Validation Error",
        description: "Please provide a valid category and amount.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      await financialService.updateDailyExpense(selectedExpense.id, editedExpenseData);
      toast({
        title: "✅ Success",
        description: "Expense updated successfully.",
      });
      setIsEditDialogOpen(false);
      fetchExpenses(); // Refresh expenses list
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to update expense.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedExpense) return;

    setIsUpdating(true);
    try {
      await financialService.deleteDailyExpense(selectedExpense.id);
      toast({
        title: "✅ Success",
        description: "Expense deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      fetchExpenses(); // Refresh expenses list
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to delete expense.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            {t("allExpenses.title")}
            {filteredExpenses.length > 0 && (
              <span className="text-lg text-muted-foreground">
                {t("allExpenses.expenseCount", { count: filteredExpenses.length })}
              </span>
            )}
          </h2>
          <p className="text-muted-foreground">{t("allExpenses.subtitle")}</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {t("filters.filters")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>{t("filters.from")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFilter.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter.from ? format(dateFilter.from, "PPP") : t("filters.pickDate")}
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

            <div className="space-y-2">
              <Label>{t("filters.to")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFilter.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter.to ? format(dateFilter.to, "PPP") : t("filters.pickDate")}
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

            {/* Expense Type Filter */}
            <div className="space-y-2">
              <Label>Expense Type</Label>
              <Select value={expenseTypeFilter} onValueChange={setExpenseTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="fuel">{t("expenses.categories.fuel")}</SelectItem>
                  <SelectItem value="subsidy">{t("expenses.categories.subsidy")}</SelectItem>
                  <SelectItem value="other">{t("expenses.categories.other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Report Type Filter */}
            <div className="space-y-2">
              <Label>{t("filters.reportType")}</Label>
              <Select value={reportTypeFilter} onValueChange={(value: "all" | "agaseke" | "regular") => setReportTypeFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allVehicles")}</SelectItem>
                  <SelectItem value="agaseke">{t("filters.agasekeVehicles")}</SelectItem>
                  <SelectItem value="regular">{t("filters.regularVehicles")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <Label>{t("filters.view")}</Label>
              <div className="flex rounded-md border">
                <Button
                  variant={groupByDate ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGroupByDate(true)}
                  className="rounded-r-none"
                >
                  {t("allExpenses.groupedByDate")}
                </Button>
                <Button
                  variant={!groupByDate ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGroupByDate(false)}
                  className="rounded-l-none"
                >
                  {t("allExpenses.individualExpenses")}
                </Button>
              </div>
            </div>

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={() => {
                setDateFilter({ from: new Date(), to: new Date() });
                setExpenseTypeFilter("all");
                setReportTypeFilter("all");
                setGroupByDate(true);
              }}
            >
              {t("filters.clearFilters")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
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
                  <TableHead className="text-right">{t("allExpenses.expenseCount")}</TableHead>
                  <TableHead className="text-right">{t("allExpenses.totalAmount")}</TableHead>
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
                          <span>{group.vehicles.length} vehicles</span>
                          <div className="flex gap-1">
                            {group.vehicles.some(plate => isAgasekeVehicle(plate)) && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                                Agaseke
                              </Badge>
                            )}
                            {group.vehicles.some(plate => !isAgasekeVehicle(plate)) && (
                              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                                Regular
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {group.vehicles.join(', ')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{group.expenseCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(group.totalAmount)}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleViewDetails(group.date)}>
                        {t("table.viewDetails")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-bold">{t("table.total")}</TableCell>
                  <TableCell className="text-right font-bold">{displayData.reduce((acc, group) => acc + group.expenseCount, 0)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(displayData.reduce((acc, group) => acc + group.totalAmount, 0))}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            // Individual Expenses View
            <>
              {filteredExpenses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.date")}</TableHead>
                      <TableHead>{t("table.vehicle")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("table.route")}</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="hidden sm:table-cell">Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">{t("table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{format(parseISO(expense.report.report_date), "PP")}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{expense.report.vehicle_plate}</span>
                            {isAgasekeVehicle(expense.report.vehicle_plate) && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                                {t("status.agaseke")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{expense.report.route || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{expense.category}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{expense.description || "-"}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(expense.amount)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewExpense(expense)}
                              className="h-8 w-8 p-0"
                              title="View expense details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditExpense(expense)}
                              className="h-8 w-8 p-0"
                              title="Edit expense"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteExpense(expense)}
                              className="h-8 w-8 p-0 hover:bg-red-50"
                              title="Delete expense"
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
                      <TableCell colSpan={6} className="font-bold">{t("table.total")}</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(filteredExpenses.reduce((acc, expense) => acc + expense.amount, 0))}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">{t("allExpenses.noExpensesFound")}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* View Expense Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("allExpenses.expenseDetails")}</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Date</Label>
                  <p className="text-sm">{format(parseISO(selectedExpense.report.report_date), "PPP")}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Vehicle</Label>
                  <p className="text-sm">{selectedExpense.report.vehicle_plate}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Route</Label>
                  <p className="text-sm">{selectedExpense.report.route || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Category</Label>
                  <p className="text-sm">{selectedExpense.category}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Amount</Label>
                  <p className="text-sm font-semibold">{formatCurrency(selectedExpense.amount)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm">{selectedExpense.description || "-"}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              {t("buttons.close")}
            </Button>
            <Button onClick={() => {
              setIsViewDialogOpen(false);
              if (selectedExpense) handleEditExpense(selectedExpense);
            }}>
              {t("buttons.edit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("expenses.editExpense")}</DialogTitle>
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
                  <SelectItem value="Fuel">{t("expenses.categories.fuel")}</SelectItem>
                  <SelectItem value="Subsidy">{t("expenses.categories.subsidy")}</SelectItem>
                  <SelectItem value="Other">{t("expenses.categories.other")}</SelectItem>
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
              <Input 
                name="amount" 
                type="number" 
                value={editedExpenseData.amount} 
                onChange={handleExpenseInputChange} 
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                name="description" 
                value={editedExpenseData.description} 
                onChange={handleExpenseInputChange} 
                placeholder="Optional description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t("buttons.cancel")}
            </Button>
            <Button onClick={handleUpdateExpense} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("buttons.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Expense Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedExpense && (
                `This action cannot be undone. This will permanently delete the expense "${selectedExpense.category}" of ${formatCurrency(selectedExpense.amount)} from the report for ${selectedExpense.report.vehicle_plate} on ${format(parseISO(selectedExpense.report.report_date), "PPP")}.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              disabled={isUpdating}
              className="bg-red-600 hover:bg-red-700"
            >
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 