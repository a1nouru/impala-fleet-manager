"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { 
  Search, 
  PlusCircle,
  DollarSign,
  Package,
  Receipt,
  CalendarIcon,
  Loader2,
  PencilIcon,
  TrashIcon,
  Download,
  ChevronLeft,
  ChevronRight,
  Upload,
  X
} from "lucide-react"
import { inventoryService } from "@/services/inventoryService"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/context/AuthContext"
import { format, parseISO } from "date-fns"
import { useTranslation } from "@/hooks/useTranslation"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { busParts } from "@/data/partsData"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Type definitions
interface InventoryItem {
  id: string;
  code: string;
  date: string;
  item_name: string;
  description: string;
  quantity: number;
  amount_unit: number;
  total_cost: number;
  receipt_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Loading component
function LoadingState() {
  return (
    <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center gap-4 bg-white rounded-lg shadow p-8">
      <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
      <div className="text-center">
        <p className="text-xl font-semibold text-gray-800 mb-2">Loading Inventory...</p>
        <p className="text-gray-500">Please wait while we fetch your data</p>
      </div>
    </div>
  )
}

// Utility function to export data to Excel
const exportToExcel = (data: InventoryItem[], filename: string) => {
  const headers = [
    "Date", 
    "Item Name",
    "Description",
    "Quantity (UN)",
    "Amount Unit (Kz)",
    "Total Cost (Kz)"
  ];

  const cleanData = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return str.replace(/[\r\n\t]/g, ' ').replace(/"/g, '""').trim();
  };

  const totalCost = data.reduce((sum, item) => sum + (item.total_cost || 0), 0);

  const csvRows = [
    headers.map(header => `"${header}"`).join(','),
    ...data.map(item => [
      `"${cleanData(item.date)}"`,
      `"${cleanData(item.item_name || 'N/A')}"`,
      `"${cleanData(item.description)}"`,
      `"${cleanData(item.quantity)}"`,
      `"${cleanData(item.amount_unit)}"`,
      `"${cleanData(item.total_cost)}"`,
    ].join(',')),
    '',
    [
      '"TOTAL"',
      '""',
      '""', 
      '""',
      '""',
      `"${totalCost.toLocaleString()}"`,
    ].join(',')
  ];

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { 
    type: 'text/csv;charset=utf-8;' 
  });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename.replace('.xlsx', '.csv'));
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function InventoryManagement() {
  // State for data
  const [items, setItems] = useState<InventoryItem[]>([]);
  
  // UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Download state
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadDateRange, setDownloadDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  
  // Loading states
  const [isLoading, setIsLoading] = useState({
    items: true,
    submit: false,
    pageReady: false
  });

  const [newItem, setNewItem] = useState({
    date: "",
    item_name: "",
    description: "",
    quantity: "",
    amount_unit: "",
  });

  const { user } = useAuth();
  const { t } = useTranslation('maintenance'); // Reusing maintenance translations for now

  // Get all parts in a flat list for the dropdown
  const getAllParts = () => {
    const allParts: { id: string; name: string; category: string }[] = [];
    busParts.forEach(category => {
      category.items.forEach(item => {
        allParts.push({
          id: item.id,
          name: item.name,
          category: category.category
        });
      });
    });
    return allParts;
  };

  const allParts = getAllParts();

  // Fetch inventory items on component mount
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        const itemsData = await inventoryService.getInventoryItems();
        
        if (!isMounted) return;
        
        setItems(itemsData || []);
        setIsLoading({
          items: false,
          submit: false,
          pageReady: true
        });
      } catch (error) {
        console.error('Error fetching inventory data:', error);
        if (isMounted) {
          toast({
            title: "⚠️ Database Setup Required",
            description: "Inventory table not found. Please run the database migrations first.",
            variant: "destructive"
          });
          
          setIsLoading({
            items: false,
            submit: false,
            pageReady: true
          });
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange]);
  
  if (!isLoading.pageReady) {
    return <LoadingState />;
  }
  
  // Format number with commas
  const formatNumber = (value: string) => {
    const numericValue = value.replace(/[^\d.]/g, '');
    const parts = numericValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const parseFormattedNumber = (formattedValue: string) => {
    return formattedValue.replace(/,/g, '');
  };

  // Calculate totals
  const totalLifetimeCost = items.reduce((sum, item) => sum + (item.total_cost || 0), 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthItems = items.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
  });
  const currentMonthCost = currentMonthItems.reduce((sum, item) => sum + (item.total_cost || 0), 0);

  // Filter items based on search term and date range
  const filteredItems = items.filter(item => {
    // Filter by date range
    if (dateRange?.from || dateRange?.to) {
      const itemDate = new Date(item.date);
      
      if (dateRange.from && itemDate < dateRange.from) {
        return false;
      }
      
      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (itemDate > endOfDay) {
          return false;
        }
      }
    }
    
    // Filter by search term
    if (searchTerm && 
        !item.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(item.item_name && item.item_name.toLowerCase().includes(searchTerm.toLowerCase()))
      ) {
      return false;
    }
    
    return true;
  });

  // Pagination logic
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageItems = filteredItems.slice(startIndex, endIndex);

  // Form validation
  const isFormValid = () => {
    const requiredFields = ['date', 'item_name', 'description', 'quantity', 'amount_unit'];
    const isFieldsValid = requiredFields.every(field => !!newItem[field as keyof typeof newItem]);
    const isReceiptValid = isEditMode ? true : !!receiptFile; // Receipt required for new items
    return isFieldsValid && isReceiptValid;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'quantity' || name === 'amount_unit') {
      const formattedValue = formatNumber(value);
      setNewItem(prev => ({ ...prev, [name]: formattedValue }));
    } else {
      setNewItem(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (allow images and PDFs)
      const allowedTypes = ['image/', 'application/pdf'];
      const isValidType = allowedTypes.some(type => file.type.startsWith(type));
      
      if (!isValidType) {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file (JPG, PNG, etc.) or PDF for the receipt.",
          variant: "destructive"
        });
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 10MB.",
          variant: "destructive"
        });
        return;
      }
      
      setReceiptFile(file);
      
      // Create preview (only for images, show file name for PDFs)
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setReceiptPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        // For PDFs, store the file name as preview
        setReceiptPreview(`PDF: ${file.name}`);
      }
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setIsEditMode(true);
    setEditItemId(item.id);
    
    const formattedDate = (() => {
      if (!item.date) return "";
      try {
        const dateParts = item.date.split('T')[0];
        return dateParts;
      } catch (error) {
        console.error('Error formatting date for edit:', error);
        return item.date;
      }
    })();
    
    setNewItem({
      date: formattedDate,
      item_name: item.item_name || "",
      description: item.description,
      quantity: item.quantity.toString(),
      amount_unit: item.amount_unit.toString(),
    });
    
    if (item.receipt_url) {
      setReceiptPreview(item.receipt_url);
    }
    
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields and upload a receipt.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(prev => ({ ...prev, submit: true }));
    
    try {
      let receiptUrl = receiptPreview; // Use existing URL for edits
      
      // Upload receipt if new file selected
      if (receiptFile) {
        receiptUrl = await inventoryService.uploadReceipt(receiptFile, editItemId || undefined);
      }
      
      const itemToSave = {
        date: newItem.date,
        item_name: newItem.item_name,
        description: newItem.description,
        quantity: parseFloat(parseFormattedNumber(newItem.quantity)),
        amount_unit: parseFloat(parseFormattedNumber(newItem.amount_unit)),
        receipt_url: receiptUrl,
      };

      let savedItem;
      const created_by_email = user?.email;
      
      if (isEditMode && editItemId) {
        savedItem = await inventoryService.updateInventoryItem(editItemId, itemToSave);
        toast({
          title: "✅ Success",
          description: "Inventory item updated successfully",
        });
      } else {
        savedItem = await inventoryService.createInventoryItem(itemToSave, created_by_email);
        toast({
          title: "✅ Success", 
          description: "Inventory item created successfully",
        });
      }

      // Refresh the list
      const updatedItems = await inventoryService.getInventoryItems();
      setItems(updatedItems);

      // Close dialog and reset form
      setDialogOpen(false);
      resetForm();

    } catch (error) {
      console.error("Error with inventory item:", error);
      toast({
        title: "❌ Error",
        description: "Failed to save inventory item. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const resetForm = () => {
    setNewItem({
      date: "",
      item_name: "",
      description: "",
      quantity: "",
      amount_unit: "",
    });
    setReceiptFile(null);
    setReceiptPreview(null);
    setIsEditMode(false);
    setEditItemId(null);
  };
  
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleDeleteConfirm = async () => {
    if (itemToDelete) {
      try {
        await inventoryService.deleteInventoryItem(itemToDelete);
        const updatedItems = await inventoryService.getInventoryItems();
        setItems(updatedItems);
        setDeleteDialogOpen(false);
        toast({
          title: "✅ Success",
          description: "Inventory item deleted successfully"
        });
      } catch (error) {
        console.error('Error deleting inventory item:', error);
        toast({
          title: "❌ Error",
          description: "Failed to delete inventory item. Please try again.",
          variant: "destructive"
        });
      }
    }
  };
  
  const handleResetConfirm = () => {
    resetForm();
    setResetDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <h1 className="text-xl md:text-2xl font-semibold text-gray-800">Inventory Management</h1>
        
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button 
              className="bg-black hover:bg-gray-800 text-white w-full sm:w-auto" 
              disabled={isLoading.items}
              onClick={() => {
                resetForm();
                setIsEditMode(false);
              }}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add Purchase</span>
              <span className="sm:hidden">Add Item</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto mx-4 w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {isEditMode ? "Edit Inventory Item" : "Add Purchase"}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {isEditMode 
                  ? "Update the inventory item details below."
                  : "Add a new purchased item with receipt."
                }
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center text-sm">
                    Date <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newItem.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newItem.date ? (
                          format(parseISO(newItem.date), "PPP")
                        ) : (
                          <span>Select a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newItem.date ? parseISO(newItem.date) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setNewItem(prev => ({ ...prev, date: format(date, "yyyy-MM-dd") }))
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="flex items-center text-sm">
                    Quantity (UN) <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="text"
                    placeholder="Enter quantity"
                    value={newItem.quantity}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount_unit" className="flex items-center text-sm">
                    Amount Unit (Kz) <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="amount_unit"
                    name="amount_unit"
                    type="text"
                    placeholder="Price per unit"
                    value={newItem.amount_unit}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center text-sm">
                    Total Cost (Kz)
                  </Label>
                  <Input
                    type="text"
                    value={
                      newItem.quantity && newItem.amount_unit
                        ? (parseFloat(parseFormattedNumber(newItem.quantity)) * 
                           parseFloat(parseFormattedNumber(newItem.amount_unit))).toLocaleString()
                        : "0"
                    }
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item_name" className="flex items-center text-sm">
                  Item Name <span className="text-red-500 ml-1">*</span>
                </Label>
                <Select
                  value={newItem.item_name}
                  onValueChange={(value) => {
                    setNewItem(prev => ({ ...prev, item_name: value }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an item or enter custom name" />
                  </SelectTrigger>
                  <SelectContent>
                    {allParts.map((part) => (
                      <SelectItem key={part.id} value={part.name}>
                        <div className="flex flex-col">
                          <span>{part.name}</span>
                          <span className="text-xs text-muted-foreground">{part.category}</span>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">
                      <span className="text-blue-600 font-medium">Enter custom item name...</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {newItem.item_name === "custom" && (
                  <Input
                    placeholder="Enter custom item name"
                    value=""
                    onChange={(e) => setNewItem(prev => ({ ...prev, item_name: e.target.value }))}
                    className="mt-2"
                    autoFocus
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="flex items-center text-sm">
                  Description <span className="text-red-500 ml-1">*</span>
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Enter item description"
                  rows={3}
                  value={newItem.description}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center text-sm">
                  Receipt <span className="text-red-500 ml-1">*</span>
                  {isEditMode && " (Upload new to replace)"}
                </Label>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {receiptPreview && (
                    <div className="relative">
                      {receiptPreview.startsWith('PDF:') ? (
                        <div className="flex items-center gap-2 p-3 border rounded bg-gray-50">
                          <Receipt className="h-5 w-5 text-red-500" />
                          <span className="text-sm font-medium">{receiptPreview}</span>
                        </div>
                      ) : (
                        <img 
                          src={receiptPreview} 
                          alt="Receipt preview" 
                          className="max-w-full h-32 object-cover rounded border"
                        />
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={() => {
                          setReceiptFile(null);
                          setReceiptPreview(null);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                <span className="text-black">*</span> Required fields
              </div>
            </div>
            <DialogFooter>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isLoading.submit}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading.submit}
                  onClick={() => setResetDialogOpen(true)}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSubmit} 
                  disabled={!isFormValid() || isLoading.submit}
                  className="bg-black hover:bg-gray-800 text-white"
                >
                  {isLoading.submit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditMode ? "Update" : "Add Item"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading.items ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xl ml-4">Loading Inventory...</span>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-4 md:mb-6">
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-emerald-900">
                  Current Month Cost
                </CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold text-emerald-900">{currentMonthCost.toLocaleString()} Kz</div>
                <p className="text-xs text-emerald-700">
                  Total expenses for {new Date().toLocaleString('default', { month: 'long' })} {new Date().getFullYear()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Items
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold">{items.length}</div>
                <p className="text-xs text-muted-foreground">
                  Lifetime inventory records
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  This Month Items
                </CardTitle>
                <Package className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold">{currentMonthItems.length}</div>
                <p className="text-xs text-muted-foreground">
                  Items purchased this month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Value
                </CardTitle>
                <Receipt className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold">{totalLifetimeCost.toLocaleString()} Kz</div>
                <p className="text-xs text-muted-foreground">
                  Total inventory value
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b">
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <DateRangePicker 
                    date={dateRange} 
                    onDateChange={setDateRange}
                    className="w-full sm:w-auto"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search items..."
                      className="pl-8 h-9 w-full sm:w-[200px] lg:w-[300px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDownloadDialogOpen(true)}
                    className="h-9"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Download</span>
                    <span className="sm:hidden">Excel</span>
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Item Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Quantity (UN)</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Amount Unit</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Total Cost</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPageItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        No inventory items found
                      </td>
                    </tr>
                  ) : (
                    currentPageItems.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm">
                          {(() => {
                            try {
                              if (item.date.includes('-')) {
                                const [year, month, day] = item.date.split('T')[0].split('-');
                                return `${month}/${day}/${year}`;
                              }
                              const dateStr = item.date.split('T')[0];
                              const [year, month, day] = dateStr.split('-').map(Number);
                              return `${month}/${day}/${year}`;
                            } catch (e) {
                              return new Date(item.date).toLocaleDateString();
                            }
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate font-medium">{item.item_name || "N/A"}</td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{item.description}</td>
                        <td className="px-4 py-3 text-sm text-right">{item.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right">{item.amount_unit.toLocaleString()} Kz</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">{item.total_cost.toLocaleString()} Kz</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <div className="flex items-center justify-end gap-2">
                            {item.receipt_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(item.receipt_url, '_blank')}
                                className="h-8 w-8 p-0"
                              >
                                <Receipt className="h-4 w-4 text-blue-600" />
                                <span className="sr-only">View Receipt</span>
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEditItem(item)}
                              className="h-8 w-8 p-0"
                            >
                              <PencilIcon className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setItemToDelete(item.id);
                                setDeleteDialogOpen(true);
                              }}
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <TrashIcon className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredItems.length > 0 && (
                  <tfoot className="bg-black text-white">
                    <tr>
                      <td className="px-4 py-3 text-sm font-bold">Total</td>
                      <td className="px-4 py-3 text-sm"></td>
                      <td className="px-4 py-3 text-sm"></td>
                      <td className="px-4 py-3 text-sm"></td>
                      <td className="px-4 py-3 text-sm"></td>
                      <td className="px-4 py-3 text-sm text-right font-bold">
                        AOA {filteredItems.reduce((sum, item) => sum + (item.total_cost || 0), 0).toLocaleString()}.00
                      </td>
                      <td className="px-4 py-3 text-sm"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            
            {/* Mobile Card View */}
            <div className="lg:hidden">
              {currentPageItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No inventory items found
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  {currentPageItems.map((item) => (
                    <Card key={item.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{item.item_name || "N/A"}</h3>
                            <p className="text-sm text-muted-foreground">
                              {(() => {
                                try {
                                  if (item.date.includes('-')) {
                                    const [year, month, day] = item.date.split('T')[0].split('-');
                                    return `${month}/${day}/${year}`;
                                  }
                                  const dateStr = item.date.split('T')[0];
                                  const [year, month, day] = dateStr.split('-').map(Number);
                                  return `${month}/${day}/${year}`;
                                } catch (e) {
                                  return new Date(item.date).toLocaleDateString();
                                }
                              })()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.receipt_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(item.receipt_url, '_blank')}
                                className="h-8 w-8 p-0"
                              >
                                <Receipt className="h-4 w-4 text-blue-600" />
                                <span className="sr-only">View Receipt</span>
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEditItem(item)}
                              className="h-8 w-8 p-0"
                            >
                              <PencilIcon className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setItemToDelete(item.id);
                                setDeleteDialogOpen(true);
                              }}
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <TrashIcon className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Item Name</p>
                            <p className="text-sm text-gray-600 font-medium">{item.item_name || "N/A"}</p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-700">Description</p>
                            <p className="text-sm text-gray-600">{item.description}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-gray-700">Quantity</p>
                              <p className="text-sm text-gray-600">{item.quantity.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700">Unit Price</p>
                              <p className="text-sm text-gray-600">{item.amount_unit.toLocaleString()} Kz</p>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-700">Total Cost</p>
                            <p className="text-sm font-semibold text-gray-900">{item.total_cost.toLocaleString()} Kz</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {/* Mobile Totals Footer */}
              {filteredItems.length > 0 && (
                <div className="p-4 bg-black text-white rounded-lg mx-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm">Total</span>
                    <span className="font-bold text-sm">
                      AOA {filteredItems.reduce((sum, item) => sum + (item.total_cost || 0), 0).toLocaleString()}.00
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Pagination Controls */}
            {filteredItems.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 border-t space-y-2 sm:space-y-0">
                <div className="text-sm text-muted-foreground text-center sm:text-left">
                  Showing <span className="font-medium">{currentPageItems.length}</span> of{" "}
                  <span className="font-medium">{totalItems}</span> items
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
          </div>
        </>
      )}

      {/* Reset dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Form</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset the form? All unsaved changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetConfirm}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Inventory Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this inventory item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} className="bg-black hover:bg-gray-800 text-white">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download dialog */}
      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className="sm:max-w-[425px] mx-4 w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Download Inventory Records</DialogTitle>
            <DialogDescription>
              Select a date range to download inventory records as Excel file.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
                <Label className="text-sm font-medium shrink-0">From:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[140px] justify-start text-left font-normal",
                        !downloadDateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {downloadDateRange.from ? format(downloadDateRange.from, "MMM dd") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={downloadDateRange.from}
                      onSelect={(date) => setDownloadDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
                <Label className="text-sm font-medium shrink-0">To:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[140px] justify-start text-left font-normal",
                        !downloadDateRange.to && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {downloadDateRange.to ? format(downloadDateRange.to, "MMM dd") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={downloadDateRange.to}
                      onSelect={(date) => setDownloadDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setDownloadDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const from = downloadDateRange.from ? format(downloadDateRange.from, "yyyy-MM-dd") : undefined;
                const to = downloadDateRange.to ? format(downloadDateRange.to, "yyyy-MM-dd") : undefined;
                exportToExcel(items.filter(r => {
                  const itemDate = new Date(r.date);
                  const isFromDate = from ? itemDate >= new Date(from) : true;
                  const isToDate = to ? itemDate <= new Date(to) : true;
                  return isFromDate && isToDate;
                }), `inventory_records_${from || 'all'}_to_${to || 'all'}.xlsx`);
                setDownloadDialogOpen(false);
                toast({
                  title: "✅ Download Started",
                  description: `Downloading ${items.filter(r => {
                    const itemDate = new Date(r.date);
                    const isFromDate = from ? itemDate >= new Date(from) : true;
                    const isToDate = to ? itemDate <= new Date(to) : true;
                    return isFromDate && isToDate;
                  }).length} records...`
                });
              }}
              className="w-full sm:w-auto"
            >
              Download Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
   </div>
  )
}