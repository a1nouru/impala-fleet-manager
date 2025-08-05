"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, PlusCircle, Filter, CalendarIcon, Receipt, Edit, Trash2, ChevronLeft, ChevronRight, Paperclip, Search, X } from "lucide-react";
import { financialService, CompanyExpense } from "@/services/financialService";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

// Helper to format currency
const formatCurrency = (value: number) => {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "AOA",
  });
};



export default function CompanyExpensesPage() {
  const { user } = useAuth();
  const { t } = useTranslation('financials');
  const pathname = usePathname();
  const [expenses, setExpenses] = useState<CompanyExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog states
  const [addExpenseDialogOpen, setAddExpenseDialogOpen] = useState(false);
  const [editExpenseDialogOpen, setEditExpenseDialogOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<CompanyExpense | null>(null);
  const [selectedReceipts, setSelectedReceipts] = useState<any[]>([]);

  // Filter states
  const [dateFilter, setDateFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(),
    to: new Date(),
  });

  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20;

  // Form states for adding/editing expenses
  const [expenseFormData, setExpenseFormData] = useState({
    expense_date: format(new Date(), "yyyy-MM-dd"),
    category: "",
    description: "",
    amount: "",
    has_receipt: false,
  });

  // Receipt upload states
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [noReceiptSelected, setNoReceiptSelected] = useState(false);

  // Search functionality
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      const data = await financialService.getCompanyExpenses();
      setExpenses(data);
    } catch (error: any) {
      console.error('Error fetching expenses:', error);
      
      // Show specific toast based on error type  
      if (error.message?.includes('relation') && error.message?.includes('company_expenses') && error.message?.includes('does not exist')) {
        toast({
          title: "⚠️ Database Setup Required",
          description: "Company expenses tables need to be created. Please run the database migration SQL.",
          variant: "destructive",
        });
      } else if (error.message?.includes('permission denied') || 
                 error.message?.includes('RLS') ||
                 error.message?.includes('policy') ||
                 error.code === 'PGRST301') {
        toast({
          title: "🔒 Permission Setup Required", 
          description: "Database permissions (RLS policies) need to be configured. Please run the RLS policies SQL.",
          variant: "destructive",
        });
      } else if (error.message?.includes('relationship') && 
                 error.message?.includes('schema cache') ||
                 error.code === 'PGRST200') {
        toast({
          title: "🔗 Foreign Key Setup Required",
          description: "Database relationship missing. Please run the foreign key SQL fix.",
          variant: "destructive", 
        });
      } else {
        toast({
          title: "❌ Error",
          description: `Failed to load company expenses: ${error.message || 'Unknown error'}`,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Search for existing categories
  const searchCategories = async (term: string) => {
    if (term.length >= 2) {
      try {
        const results = await financialService.searchCompanyExpenseCategories(term);
        setSearchResults(results);
        setShowSearchResults(true);
      } catch (error: any) {
        console.error("Error searching categories:", error);
        // Don't show error toast for search - just fail silently
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (categorySearchTerm) {
        searchCategories(categorySearchTerm);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [categorySearchTerm]);

  // Filter expenses based on date range and category
  const filteredExpenses = expenses.filter(expense => {
    const expenseDate = parseISO(expense.expense_date);
    
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
    
    // Category filter
    const categoryMatch = categoryFilter === "all" || expense.category.toLowerCase().includes(categoryFilter.toLowerCase());
    
    return dateMatch && categoryMatch;
  });

  // Pagination logic
  const totalRecords = filteredExpenses.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentPageExpenses = filteredExpenses.slice(startIndex, endIndex);



  // Format number with commas for display only
  const formatNumberWithCommas = (value: string | number): string => {
    if (!value && value !== 0) return '';
    
    const numStr = value.toString();
    const num = parseFloat(numStr.replace(/,/g, ''));
    
    if (isNaN(num)) return '';
    
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  // Remove commas for calculation/storage
  const removeCommas = (value: string): string => {
    return value.replace(/,/g, '');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === "amount") {
      // Store the raw input value (user is typing)
      // Only allow numbers, decimal point, and remove any other characters
      const cleanValue = value.replace(/[^\d.]/g, '');
      
      // Handle multiple decimal points - keep only the first one
      const firstDotIndex = cleanValue.indexOf('.');
      const finalValue = firstDotIndex === -1 
        ? cleanValue 
        : cleanValue.substring(0, firstDotIndex + 1) + cleanValue.substring(firstDotIndex + 1).replace(/\./g, '');
      
      setExpenseFormData(prev => ({
        ...prev,
        [name]: finalValue,
      }));
    } else {
      setExpenseFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCategorySearchTerm(value);
    setExpenseFormData(prev => ({ ...prev, category: value }));
  };

  const selectCategory = (category: string) => {
    setCategorySearchTerm(category);
    setExpenseFormData(prev => ({ ...prev, category }));
    setShowSearchResults(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          toast({
            title: "Invalid File Type",
            description: `${file.name} is not a valid file type. Please upload PDF, JPG, or PNG files only.`,
            variant: "destructive",
          });
          return;
        }
        
        if (file.size > maxSize) {
          toast({
            title: "File Too Large",
            description: `${file.name} is too large. Maximum file size is 5MB.`,
            variant: "destructive",
          });
          return;
        }
      }
      
      setReceiptFiles(prev => [...prev, ...files]);
      setExpenseFormData(prev => ({ ...prev, has_receipt: true }));
      setNoReceiptSelected(false);
    }
  };

  const removeReceiptFile = (index: number) => {
    setReceiptFiles(prev => prev.filter((_, i) => i !== index));
    if (receiptFiles.length === 1) {
      setExpenseFormData(prev => ({ ...prev, has_receipt: noReceiptSelected }));
    }
  };

  const handleNoReceiptToggle = () => {
    setNoReceiptSelected(!noReceiptSelected);
    setExpenseFormData(prev => ({ ...prev, has_receipt: receiptFiles.length > 0 || !noReceiptSelected }));
  };

  const resetForm = () => {
    setExpenseFormData({
      expense_date: format(new Date(), "yyyy-MM-dd"),
      category: "",
      description: "",
      amount: "",
      has_receipt: false,
    });
    setReceiptFiles([]);
    setNoReceiptSelected(false);
    setCategorySearchTerm("");
    setShowSearchResults(false);
  };

  const handleSubmit = async () => {
    const amount = parseFloat(expenseFormData.amount as string);
    if (!expenseFormData.category || !expenseFormData.amount || amount <= 0 || isNaN(amount)) {
      toast({
        title: "Validation Error",
        description: "Please provide a category and valid amount for the expense.",
        variant: "destructive",
      });
      return;
    }

    if (!noReceiptSelected && receiptFiles.length === 0) {
      toast({
        title: "Receipt Required",
        description: "Please upload a receipt or indicate that no receipt is available.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const expenseData = {
        ...expenseFormData,
        amount: parseFloat(expenseFormData.amount as string),
        has_receipt: receiptFiles.length > 0,
        created_by: user?.email,
      };

      if (receiptFiles.length > 0) {
        await financialService.createCompanyExpenseWithReceipt(expenseData, receiptFiles);
      } else {
        await financialService.createCompanyExpense(expenseData);
      }

      toast({
        title: "✅ Success",
        description: "Company expense created successfully.",
      });

      setAddExpenseDialogOpen(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to create expense. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditExpense = (expense: CompanyExpense) => {
    setSelectedExpense(expense);
    setExpenseFormData({
      expense_date: expense.expense_date,
      category: expense.category,
      description: expense.description || "",
      amount: expense.amount.toString(), // Store as raw string without commas
      has_receipt: expense.has_receipt,
    });
    setCategorySearchTerm(expense.category);
    setEditExpenseDialogOpen(true);
  };

  const handleUpdateExpense = async () => {
    const amount = parseFloat(expenseFormData.amount as string);
    if (!selectedExpense || !expenseFormData.category || !expenseFormData.amount || amount <= 0 || isNaN(amount)) {
      toast({
        title: "Validation Error",
        description: "Please provide a category and valid amount for the expense.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await financialService.updateCompanyExpense(selectedExpense.id, {
        expense_date: expenseFormData.expense_date,
        category: expenseFormData.category,
        description: expenseFormData.description,
        amount: parseFloat(expenseFormData.amount as string),
        has_receipt: expenseFormData.has_receipt,
      });

      toast({
        title: "✅ Success",
        description: "Expense updated successfully.",
      });

      setEditExpenseDialogOpen(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to update expense.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = (expense: CompanyExpense) => {
    setSelectedExpense(expense);
    setDeleteConfirmationOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedExpense) return;

    setIsSubmitting(true);
    try {
      await financialService.deleteCompanyExpense(selectedExpense.id);
      toast({
        title: "✅ Success",
        description: "Expense deleted successfully.",
      });
      setDeleteConfirmationOpen(false);
      fetchExpenses();
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to delete expense.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetails = (dateString: string) => {
    const date = parseISO(dateString);
    setDateFilter({ from: date, to: date });
  };

  const handleViewReceipt = (expense: CompanyExpense) => {
    console.log('🧾 Viewing receipts for expense:', expense);
    console.log('🧾 Has receipt:', expense.has_receipt);
    console.log('🧾 Receipt array:', expense.company_expense_receipts);
    
    if (!expense.has_receipt || !expense.company_expense_receipts || expense.company_expense_receipts.length === 0) {
      toast({
        title: "No Receipt",
        description: "No receipt is attached to this expense.",
        variant: "destructive",
      });
      return;
    }

    // Set the receipts and open modal
    setSelectedReceipts(expense.company_expense_receipts);
    setReceiptModalOpen(true);
  };

  const expenseSubNavItems = [
    {
      name: t("allExpenses.title"),
      href: "/dashboard/financials/expenses",
    },
    {
      name: t("navigation.companyExpenses"),
      href: "/dashboard/financials/company-expenses",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            {t("companyExpenses.title")}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{filteredExpenses.length} {t("companyExpenses.expenseCount", { count: filteredExpenses.length })}</Badge>
          </div>
        </div>
        
        <Dialog open={addExpenseDialogOpen} onOpenChange={setAddExpenseDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-gray-800 text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              {t("companyExpenses.addExpense")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{t("companyExpenses.addExpenseTitle")}</DialogTitle>
              <DialogDescription>
                {t("companyExpenses.addExpenseDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expense_date">{t("companyExpenses.date")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !expenseFormData.expense_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {expenseFormData.expense_date ? format(parseISO(expenseFormData.expense_date), "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={expenseFormData.expense_date ? parseISO(expenseFormData.expense_date) : undefined}
                        onSelect={(date) => setExpenseFormData(prev => ({ ...prev, expense_date: date ? format(date, "yyyy-MM-dd") : "" }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">{t("companyExpenses.amount")}</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="text"
                    value={formatNumberWithCommas(expenseFormData.amount)}
                    onChange={handleInputChange}
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="space-y-2 relative">
                <Label htmlFor="category">{t("companyExpenses.category")}</Label>
                <div className="relative">
                  <Input
                    id="category"
                    name="category"
                    value={categorySearchTerm}
                    onChange={handleCategoryChange}
                    placeholder={t("companyExpenses.searchPlaceholder")}
                    className="pr-8"
                  />
                  <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {searchResults.map((category, index) => (
                      <button
                        key={index}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 first:rounded-t-md last:rounded-b-md"
                        onClick={() => selectCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("companyExpenses.description")}</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={expenseFormData.description}
                  onChange={handleInputChange}
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>

              {/* Receipt Upload Section */}
              <div className="space-y-2">
                <Label>{t("companyExpenses.uploadReceipt")}</Label>
                <div className="space-y-3">
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="no-receipt"
                      checked={noReceiptSelected}
                      onChange={handleNoReceiptToggle}
                      className="rounded"
                    />
                    <Label htmlFor="no-receipt" className="text-sm">
                      {t("companyExpenses.noReceipt")}
                    </Label>
                  </div>

                  {receiptFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">
                        {receiptFiles.length} file(s) selected
                      </div>
                      {receiptFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                          <Paperclip className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-700 truncate flex-1">{file.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeReceiptFile(index)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddExpenseDialogOpen(false)}>
                {t("buttons.cancel")}
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-black hover:bg-gray-800 text-white">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("companyExpenses.addExpense")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sub Navigation */}
      <div className="flex border-b">
        {expenseSubNavItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "px-4 py-2 text-sm font-medium",
              pathname === item.href
                ? "bg-black text-white border-b-2 border-black"
                : "text-muted-foreground hover:text-black"
            )}
          >
            {item.name}
          </Link>
        ))}
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



            {/* Clear Filters */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter({ from: new Date(), to: new Date() });
                setCategoryFilter("all");
              }}
            >
              {t("filters.today")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter({ from: undefined, to: undefined });
                setCategoryFilter("all");
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
          ) : (
            // Individual Expenses View
            <>
              {filteredExpenses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.date")}</TableHead>
                      <TableHead>{t("companyExpenses.category")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("companyExpenses.description")}</TableHead>
                      <TableHead className="text-right">{t("companyExpenses.amount")}</TableHead>
                      <TableHead className="text-center">Receipt</TableHead>
                      <TableHead className="text-right">{t("table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPageExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{format(parseISO(expense.expense_date), "PP")}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{expense.category}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{expense.description || "-"}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(expense.amount)}</TableCell>
                        <TableCell className="text-center">
                          {expense.has_receipt ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewReceipt(expense)}
                              className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200 cursor-pointer"
                              title="Click to view receipt"
                            >
                              <Paperclip className="h-3 w-3 mr-1" />
                              {t("companyExpenses.receiptAttached")}
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-gray-600">
                              {t("companyExpenses.noReceipt")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
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
                  <TableFooter className="bg-black text-white">
                    <TableRow>
                      <TableCell colSpan={5} className="font-bold">{t("table.total")}</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(filteredExpenses.reduce((acc, expense) => acc + expense.amount, 0))}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-foreground">{t("companyExpenses.noExpensesFound")}</h3>
                      <p className="text-sm max-w-md mx-auto">
                        {t("companyExpenses.noExpensesSubtext")}
                      </p>
                    </div>
                    <Button 
                      onClick={() => setAddExpenseDialogOpen(true)}
                      className="mt-4"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t("companyExpenses.addFirstExpense")}
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Pagination Controls */}
              {filteredExpenses.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 border-t space-y-2 sm:space-y-0">
                  <div className="text-sm text-muted-foreground text-center sm:text-left">
                    Showing <span className="font-medium">{currentPageExpenses.length}</span> of{" "}
                    <span className="font-medium">{totalRecords}</span> expenses
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

      {/* Edit Expense Dialog */}
      <Dialog open={editExpenseDialogOpen} onOpenChange={setEditExpenseDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t("companyExpenses.editExpense")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_expense_date">{t("companyExpenses.date")}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !expenseFormData.expense_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expenseFormData.expense_date ? format(parseISO(expenseFormData.expense_date), "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={expenseFormData.expense_date ? parseISO(expenseFormData.expense_date) : undefined}
                      onSelect={(date) => setExpenseFormData(prev => ({ ...prev, expense_date: date ? format(date, "yyyy-MM-dd") : "" }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_amount">{t("companyExpenses.amount")}</Label>
                <Input
                  id="edit_amount"
                  name="amount"
                  type="text"
                  value={formatNumberWithCommas(expenseFormData.amount)}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_category">{t("companyExpenses.category")}</Label>
              <Input
                id="edit_category"
                name="category"
                value={categorySearchTerm}
                onChange={handleCategoryChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_description">{t("companyExpenses.description")}</Label>
              <Textarea
                id="edit_description"
                name="description"
                value={expenseFormData.description}
                onChange={handleInputChange}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExpenseDialogOpen(false)}>
              {t("buttons.cancel")}
            </Button>
            <Button onClick={handleUpdateExpense} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("buttons.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedExpense && (
                `This action cannot be undone. This will permanently delete the expense "${selectedExpense.category}" of ${formatCurrency(selectedExpense.amount)} from ${format(parseISO(selectedExpense.expense_date), "PPP")}.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Viewing Modal */}
      <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Receipt Files ({selectedReceipts.length})
            </DialogTitle>
            <DialogDescription>
              Click on any receipt to download or view it in a new tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {selectedReceipts.map((receipt, index) => (
              <div key={receipt.id || index} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">
                      {receipt.file_name || `Receipt ${index + 1}`}
                    </h4>
                    <p className="text-xs text-gray-500">
                      Uploaded: {format(parseISO(receipt.upload_date), "PPP")}
                    </p>
                    {receipt.file_size && (
                      <p className="text-xs text-gray-500">
                        Size: {(receipt.file_size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (receipt.receipt_url) {
                          window.open(receipt.receipt_url, '_blank');
                        } else {
                          toast({
                            title: "Error",
                            description: "Receipt URL is not available.",
                            variant: "destructive",
                          });
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      View/Download
                    </Button>
                  </div>
                </div>
                {receipt.receipt_url && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-400 break-all">
                      URL: {receipt.receipt_url}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {selectedReceipts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Paperclip className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No receipts found for this expense.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}