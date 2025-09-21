"use client"

import { useState, useEffect, Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { 
  Clock, 
  Filter, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  PlusCircle,
  DollarSign,
  CreditCard,
  WrenchIcon, 
  CalendarIcon,
  Loader2,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  Download,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { maintenanceService } from "@/services/maintenanceService"
import { vehicleService } from "@/services/vehicleService"
import { technicianService } from "@/services/technicianService"
import { partService } from "@/services/partService"
import { toast } from "@/components/ui/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/context/AuthContext"
import { format, parseISO } from "date-fns"
import { useTranslation } from "@/hooks/useTranslation"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import InventoryManagement from "@/components/inventory-management"

// Type definitions (moved to top for use in utility functions)
interface Vehicle {
  id: string;
  plate: string;
  model: string;
}

interface Technician {
  id: string;
  name: string;
  email?: string;
  active: boolean;
}

interface Part {
  id: string;
  name: string;
}

interface PartCategory {
  category: string;
  items: Part[];
}

interface CustomPartInput {
  category: string;
  value: string;
  showInput: boolean;
}

interface MaintenanceRecord {
  id: string;
  date: string;
  description: string;
  status: string;
  cost: number;
  kilometers?: number;
  vehicle_id?: string;
  technician_id?: string;
  vehiclePlate?: string;
  technician?: string;
  parts?: string[];
  created_by?: string;
  vehicles?: {
    plate: string;
    model: string;
  };
  technicians?: {
    name: string;
  };
}

// Loading component for better user experience
function LoadingState() {
  const { t } = useTranslation('maintenance');
  
  return (
    <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center gap-4 bg-white rounded-lg shadow p-8">
      <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
      <div className="text-center">
        <p className="text-xl font-semibold text-gray-800 mb-2">{t("loading.title")}</p>
        <p className="text-gray-500">{t("loading.subtitle")}</p>
      </div>
    </div>
  )
}

// Utility function to export data to Excel (simplified approach)
const exportToExcel = (data: MaintenanceRecord[], filename: string) => {
  const headers = [
    "Date",
    "Vehicle Plate", 
    "Description",
    "Parts",
    "Technician",
    "Status",
    "Cost (Kz)",
    "Kilometers"
  ];

  // Helper function to clean and escape data for Excel
  const cleanData = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Replace line breaks and tabs with spaces, and escape quotes
    return str.replace(/[\r\n\t]/g, ' ').replace(/"/g, '""').trim();
  };

  // Calculate totals
  const totalCost = data.reduce((sum, record) => sum + (record.cost || 0), 0);
  const totalKilometers = data.reduce((sum, record) => {
    const km = parseFloat(String(record.kilometers || 0).replace(/,/g, ''));
    return sum + (isNaN(km) ? 0 : km);
  }, 0);

  // Create Excel-compatible content with proper CSV formatting
  const csvRows = [
    // Headers
    headers.map(header => `"${header}"`).join(','),
    // Data rows
    ...data.map(record => [
      `"${cleanData(record.date)}"`,
      `"${cleanData(record.vehicles?.plate || record.vehiclePlate || '')}"`,
      `"${cleanData(record.description || '')}"`,
      `"${cleanData(record.parts ? record.parts.join('; ') : '')}"`,
      `"${cleanData(record.technicians?.name || record.technician || '')}"`,
      `"${cleanData(record.status || '')}"`,
      `"${cleanData(record.cost || 0)}"`,
      `"${cleanData(record.kilometers || '')}"`,
    ].join(',')),
    // Empty row
    '',
    // Total row
    [
      '"TOTAL"',
      '""',
      '""', 
      '""',
      '""',
      '""',
      `"${totalCost.toLocaleString()}"`,
      `"${totalKilometers.toLocaleString()}"`,
    ].join(',')
  ];

  const csvContent = csvRows.join('\n');

  // Create CSV file (more reliable than TSV)
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

export default function MaintenancePage() {
  // Add a loading state at the top level
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    // This will ensure that the loading state is shown immediately
    setIsPageLoading(true);
    
    // Set a timeout to simulate quick loading for better UX
    const loadTimer = setTimeout(() => {
      setIsPageLoading(false);
    }, 300);
    
    return () => clearTimeout(loadTimer);
  }, []);
  
  // If the page is still loading, show the loader
  if (isPageLoading) {
    return <LoadingState />;
  }

  // Continue with the regular component
  return <MaintenanceContent />;
}

// Separate the main content into its own component
function MaintenanceContent() {
  const { t } = useTranslation('maintenance');
  
  // Status options - translate these dynamically
  const statuses = [
    { value: "Scheduled", label: t("status.scheduled") },
    { value: "In Progress", label: t("maintenance.status.inProgress") }, 
    { value: "Completed", label: t("status.completed") },
    { value: "Cancelled", label: t("maintenance.status.cancelled") }
  ];

  // State for data
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [busParts, setBusParts] = useState<PartCategory[]>([]);
  
  // UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [customParts, setCustomParts] = useState<CustomPartInput[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "scheduled">("all");
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [plateFilter, setPlateFilter] = useState<string>("all");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20;
  
  // Date range state - start with no filtering to show all records
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Download state
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadDateRange, setDownloadDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date(),
  });
  
  // Loading states
  const [isLoading, setIsLoading] = useState({
    records: true,
    vehicles: true,
    technicians: true,
    parts: true,
    submit: false,
    pageReady: false
  });

  const [dataInitialized, setDataInitialized] = useState(false);

  const [newRecord, setNewRecord] = useState({
    vehiclePlate: "",
    date: "",
    status: "Scheduled", // Default to scheduled
    technician: "",
    cost: "",
    description: "",
    kilometers: "", // Add kilometers field
  });

  const { user } = useAuth();

  // Helper function to format created_by field
  const formatCreatedBy = (createdBy: string | null | undefined): string => {
    if (!createdBy) return '-';
    
    // Check if it's a UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(createdBy)) {
      return 'Legacy User'; // Display this for old UUID records
    }
    
    return createdBy; // Return email as is
  };

  // Fetch all required data on component mount
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        // Fetch all data in parallel for better performance
        const [
          maintenanceData, 
          vehicleData, 
          technicianData, 
          partData
        ] = await Promise.all([
          maintenanceService.getMaintenanceRecords(),
          vehicleService.getVehicles(),
          technicianService.getTechnicians(),
          partService.getPartsByCategory()
        ]);
        
        if (!isMounted) return;
        
        // Set the data in state
        setRecords(maintenanceData || []);
        setVehicles(vehicleData || []);
        setTechnicians(technicianData || []);
        
        // Transform the parts data
        const formattedParts = partData.map(category => ({
          category: category.name,
          items: category.parts.map(part => ({
            id: part.id,
            name: part.name
          }))
        }));
        setBusParts(formattedParts);

        // Initialize customParts array with empty entries for each category
        const initialCustomParts = partData.map(category => ({
          category: category.name,
          value: '',
          showInput: false
        }));
        setCustomParts(initialCustomParts);
        
        // Update loading states
        setIsLoading({
          records: false,
          vehicles: false,
          technicians: false,
          parts: false,
          submit: false,
          pageReady: true
        });
        
        setDataInitialized(true);
      } catch (error) {
        console.error('Error fetching data:', error);
        if (isMounted) {
          toast({
            title: "Error",
            description: "Failed to load data. Please try refreshing the page.",
            variant: "destructive"
          });
          
          // Even with error, mark loading as done to prevent infinite loading
          setIsLoading({
            records: false,
            vehicles: false,
            technicians: false,
            parts: false,
            submit: false,
            pageReady: true
          });
        }
      }
    };
    
    fetchData();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, plateFilter, dateRange]);
  
  // Skip the rest of the render if data isn't initialized
  if (!isLoading.pageReady) {
    return <LoadingState />;
  }
  
  // Format number with commas
  const formatNumber = (value: string) => {
    // Remove non-numeric characters except decimal point
    const numericValue = value.replace(/[^\d.]/g, '');
    
    // Format with commas
    const parts = numericValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    return parts.join('.');
  };

  // Parse formatted number to plain number
  const parseFormattedNumber = (formattedValue: string) => {
    return formattedValue.replace(/,/g, '');
  };

  // Calculate totals
  const totalLifetimeCost = records.reduce((sum, record) => sum + (record.cost || 0), 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthRecords = records.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
  });
  const currentMonthCost = currentMonthRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
  const completedMonthRecords = currentMonthRecords.filter(record => record.status === "Completed");
  const upcomingMaintenance = records.filter(record => record.status === "Scheduled").length;

  // Filter records based on active tab, search term, plate filter, and date range
  const filteredRecords = records.filter(record => {
    // Debug: Log the record and its parts to see what's coming from the database
    if (record.id) {
      console.debug(`Record ${record.id} parts:`, record.parts);
    }
    
    // First filter by tab (all vs scheduled)
    if (activeTab === "scheduled" && record.status !== "Scheduled") {
      return false;
    }
    
    // Filter by plate if a plate filter is selected and not set to "all"
    if (plateFilter !== "all" && 
        (record.vehicles?.plate !== plateFilter && record.vehiclePlate !== plateFilter)) {
      return false;
    }
    
    // Filter by date range
    if (dateRange?.from || dateRange?.to) {
      const recordDate = new Date(record.date);
      
      if (dateRange.from && recordDate < dateRange.from) {
        return false;
      }
      
      if (dateRange.to) {
        // Set to end of day for the 'to' date
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (recordDate > endOfDay) {
          return false;
        }
      }
    }
    
    // Then filter by search term
    if (searchTerm && 
        !record.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(record.id && record.id.toLowerCase().includes(searchTerm.toLowerCase())) &&
        !(record.vehicles && record.vehicles.plate && 
          record.vehicles.plate.toLowerCase().includes(searchTerm.toLowerCase())) &&
        !(record.parts && 
          record.parts.some(partName => partName.toLowerCase().includes(searchTerm.toLowerCase())))
      ) {
      return false;
    }
    
    return true;
  });

  // Pagination logic
  const totalRecords = filteredRecords.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentPageRecords = filteredRecords.slice(startIndex, endIndex);

  // Check if all required fields are filled
  const isFormValid = () => {
    const requiredFields = [
      'vehiclePlate', 
      'date', 
      'status', 
      'technician', 
      'cost', 
      'description',
      'kilometers'
    ];
    
    return requiredFields.every(field => !!newRecord[field as keyof typeof newRecord]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Handle special formatting for cost and kilometers
    if (name === 'cost' || name === 'kilometers') {
      const formattedValue = formatNumber(value);
      setNewRecord(prev => ({ ...prev, [name]: formattedValue }));
    } else {
      setNewRecord(prev => ({ ...prev, [name]: value }));
    }
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: false }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setNewRecord(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: false }));
    }
  };

  const handlePartToggle = (partId: string, partName: string) => {
    // Special handling for "Other" option
    if (partName === "Other") {
      // Find the category from the part ID (format: category-other)
      const categoryName = partId.split('-')[0];
      
      // Toggle the custom input visibility for this category
      setCustomParts(prev => prev.map(item => 
        item.category.toLowerCase() === categoryName 
          ? { ...item, showInput: !item.showInput } 
          : item
      ));
      
      return;
    }
    
    // Regular toggle for normal parts
    setSelectedParts(prev => {
      if (prev.includes(partName)) {
        return prev.filter(name => name !== partName);
      } else {
        return [...prev, partName];
      }
    });
  };

  // Handle custom part input change
  const handleCustomPartChange = (categoryName: string, value: string) => {
    setCustomParts(prev => prev.map(item => 
      item.category === categoryName 
        ? { ...item, value } 
        : item
    ));
  };

  // Add custom part to selected parts
  const handleAddCustomPart = (categoryName: string) => {
    const customPart = customParts.find(item => item.category === categoryName);
    
    if (customPart && customPart.value.trim()) {
      // Add the custom part to selected parts
      const newPartName = `${customPart.value.trim()} (Custom)`;
      setSelectedParts(prev => [...prev, newPartName]);
      
      // Reset the custom part input
      setCustomParts(prev => prev.map(item => 
        item.category === categoryName 
          ? { ...item, value: '', showInput: false } 
          : item
      ));
    }
  };

  const handleEditRecord = (record: MaintenanceRecord) => {
    // Set edit mode and store the record ID
    setIsEditMode(true);
    setEditRecordId(record.id);
    
    // Determine the vehicle plate - use vehicles.plate if available, otherwise vehiclePlate
    const vehiclePlate = record.vehicles?.plate || record.vehiclePlate || "";
    
    // Determine the technician name - use technicians.name if available, otherwise technician 
    const technicianName = record.technicians?.name || record.technician || "";
    
    // Fix the date display to ensure it shows the correct date in local timezone
    const formattedDate = (() => {
      // If there's no date, return empty string
      if (!record.date) return "";
      
      try {
        // For a date string like "2024-05-19", this ensures it remains "2024-05-19"
        // without timezone adjustments that could shift it to the previous day
        const dateParts = record.date.split('T')[0];
        return dateParts;
      } catch (error) {
        console.error('Error formatting date for edit:', error);
        return record.date; // Fallback to original date
      }
    })();
    
    // Populate the form with record data
    setNewRecord({
      vehiclePlate: vehiclePlate,
      date: formattedDate,
      status: record.status,
      technician: technicianName,
      cost: record.cost.toString(),
      description: record.description,
      kilometers: record.kilometers?.toString() || "",
    });
    
    // Reset custom parts
    setCustomParts(customParts.map(item => ({ ...item, value: '', showInput: false })));
    
    // Set selected parts
    setSelectedParts(record.parts || []);
    
    // Open the dialog
    setDialogOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, boolean> = {};
    const requiredFields = [
      'vehiclePlate', 
      'date', 
      'status', 
      'technician', 
      'cost', 
      'description',
      'kilometers'
    ];
    
    requiredFields.forEach(field => {
      if (!newRecord[field as keyof typeof newRecord]) {
        errors[field] = true;
      }
    });
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!validateForm()) {
      toast({
        title: t("form.validationErrorTitle"),
        description: t("form.validationError"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(prevState => ({ ...prevState, submit: true }));
    
    // Find the correct vehicle and technician IDs
    const vehicle = vehicles.find(v => v.plate === newRecord.vehiclePlate);
    const technician = technicians.find(t => t.name === newRecord.technician);
    
    if (!vehicle || !technician) {
      toast({
        title: "Error",
        description: "Invalid vehicle or technician selected.",
        variant: "destructive",
      });
      setIsLoading(prevState => ({ ...prevState, submit: false }));
      return;
    }

    // Combine standard and custom parts
    const allParts = [...selectedParts];
    customParts.forEach(part => {
      if (part.value.trim() !== "") {
        allParts.push(`${part.category}: ${part.value.trim()}`);
      }
    });

    const recordToSave = {
      vehicle_id: vehicle.id,
      date: newRecord.date,
      status: newRecord.status,
      technician_id: technician.id,
      cost: parseFormattedNumber(newRecord.cost),
      description: newRecord.description,
      kilometers: parseFormattedNumber(newRecord.kilometers),
    };

    try {
      let savedRecord;
      const created_by_email = user?.email;
      
      if (isEditMode && editRecordId) {
        // Update existing record
        savedRecord = await maintenanceService.updateMaintenanceRecord(editRecordId, recordToSave, allParts);
        toast({
          title: t("form.updateSuccessTitle"),
          description: t("form.updateSuccess"),
        });
      } else {
        // Create new record
        savedRecord = await maintenanceService.createMaintenanceRecord(recordToSave, allParts, created_by_email);
        toast({
          title: t("form.createSuccessTitle"),
          description: t("form.createSuccess"),
        });
      }

      // Fetch the updated list of records
      const updatedRecords = await maintenanceService.getMaintenanceRecords();
      setRecords(updatedRecords);

      // Close dialog and reset form
      setDialogOpen(false);
      resetForm();

    } catch (error) {
      console.error("Error with maintenance record:", error);
      toast({
        title: "Error",
        description: "Failed to create maintenance record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(prevState => ({ ...prevState, submit: false }));
    }
  };

  // Function to reset form state
  const resetForm = () => {
    setNewRecord({
      vehiclePlate: "",
      date: "",
      status: "Scheduled",
      technician: "",
      cost: "",
      description: "",
      kilometers: "",
    });
    setSelectedParts([]);
    setCustomParts(customParts.map(item => ({ ...item, value: '', showInput: false })));
    setFormErrors({});
    setIsEditMode(false);
    setEditRecordId(null);
  };
  
  // Handle dialog open state change
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const isDataLoading = isLoading.records || isLoading.vehicles || isLoading.technicians || isLoading.parts;

  const handleDeleteConfirm = async () => {
    if (recordToDelete) {
      try {
        await maintenanceService.deleteMaintenanceRecord(recordToDelete);
        const updatedRecords = await maintenanceService.getMaintenanceRecords();
        setRecords(updatedRecords);
        setDeleteDialogOpen(false);
        toast({
          title: "Success",
          description: "Maintenance record deleted successfully"
        });
      } catch (error) {
        console.error('Error deleting maintenance record:', error);
        toast({
          title: "Error",
          description: "Failed to delete maintenance record. Please try again.",
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
        <h1 className="text-xl md:text-2xl font-semibold text-gray-800">Fleet Management</h1>
      </div>

      <Tabs defaultValue="maintenance" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="maintenance" className="data-[state=active]:bg-black data-[state=active]:text-white">
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="inventory" className="data-[state=active]:bg-black data-[state=active]:text-white">
            Inventory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance" className="space-y-6">
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800">{t("title")}</h2>
        
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button 
              className="bg-black hover:bg-gray-800 text-white w-full sm:w-auto" 
              disabled={isDataLoading}
              onClick={() => {
                resetForm();
                setIsEditMode(false);
              }}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t("scheduleMaintenance")}</span>
              <span className="sm:hidden">{t("addMaintenance")}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto mx-4 w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {isEditMode ? t("editMaintenance") : t("scheduleMaintenance")}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {isEditMode 
                  ? t("dialog.editDescription")
                  : t("dialog.addDescription")
                }
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehiclePlate" className="flex items-center text-sm">
                    {t("form.vehicle")} <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Select
                    value={newRecord.vehiclePlate}
                    onValueChange={(value) => handleSelectChange("vehiclePlate", value)}
                  >
                    <SelectTrigger className={formErrors.vehiclePlate ? "border-red-500" : ""}>
                      <SelectValue placeholder={t("form.selectVehicle")} />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.plate}>
                          {vehicle.plate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.vehiclePlate && (
                    <p className="text-xs text-red-500">{t("form.vehicleRequired")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center text-sm">
                    {t("form.date")} <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <DatePicker
                    selected={newRecord.date ? parseISO(newRecord.date) : null}
                    onChange={(date: Date | null) => {
                      if (date) {
                        handleSelectChange('date', format(date, "yyyy-MM-dd"))
                      }
                    }}
                    className={`w-full h-10 px-3 py-2 text-sm bg-transparent border rounded-md shadow-sm border-input placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${formErrors.date ? "border-red-500" : ""}`}
                    placeholderText="Select a date"
                    dateFormat="MMMM d, yyyy"
                  />
                  {formErrors.date && (
                    <p className="text-xs text-red-500">{t("form.dateRequired")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kilometers" className="flex items-center text-sm">
                    {t("form.kilometers")} <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="kilometers"
                    name="kilometers"
                    type="text"
                    placeholder={t("form.kilometersPlaceholder")}
                    value={newRecord.kilometers}
                    onChange={handleInputChange}
                    required
                    className={formErrors.kilometers ? "border-red-500" : ""}
                  />
                  {formErrors.kilometers && (
                    <p className="text-xs text-red-500">{t("form.kilometersRequired")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-medium">
                    {t('dialog.status')} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={newRecord.status}
                    onValueChange={(value) => handleSelectChange("status", value)}
                  >
                    <SelectTrigger className={formErrors.status ? "border-red-500" : ""}>
                      <SelectValue placeholder={t('dialog.selectStatus')} />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="technician" className="flex items-center text-sm">
                    {t("form.technician")} <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Select
                    value={newRecord.technician}
                    onValueChange={(value) => handleSelectChange("technician", value)}
                  >
                    <SelectTrigger className={formErrors.technician ? "border-red-500" : ""}>
                      <SelectValue placeholder={t("form.selectTechnician")} />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.name}>
                          {tech.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.technician && (
                    <p className="text-xs text-red-500">{t("form.technicianRequired")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost" className="flex items-center text-sm">
                    {t("form.cost")} <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="cost"
                    name="cost"
                    type="text"
                    placeholder={t("form.costPlaceholder")}
                    value={newRecord.cost}
                    onChange={handleInputChange}
                    className={formErrors.cost ? "border-red-500" : ""}
                  />
                  {formErrors.cost && (
                    <p className="text-xs text-red-500">{t("form.costRequired")}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="flex items-center text-sm">
                  {t("form.description")} <span className="text-red-500 ml-1">*</span>
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder={t("form.descriptionPlaceholder")}
                  rows={3}
                  value={newRecord.description}
                  onChange={handleInputChange}
                  required
                  className={formErrors.description ? "border-red-500" : ""}
                />
                {formErrors.description && (
                  <p className="text-xs text-red-500">{t("form.descriptionRequired")}</p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">{t("form.parts")}</Label>
                  <span className="text-sm text-muted-foreground">{selectedParts.length} {t("form.selected")}</span>
                </div>
                <ScrollArea className="h-48 sm:h-64 border rounded-md p-4">
                  {isLoading.parts ? (
                    <div className="flex justify-center items-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-2 text-sm">{t("form.loadingParts")}</span>
                    </div>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {busParts.map((category) => (
                        <AccordionItem key={category.category} value={category.category}>
                          <AccordionTrigger className="px-2 text-sm">{category.category}</AccordionTrigger>
                          <AccordionContent>
                            <div className="grid grid-cols-1 gap-2">
                              {category.items.map((part) => (
                                <div key={part.id} className="flex items-center space-x-2">
                                  <Checkbox 
                                    id={part.id}
                                    checked={selectedParts.includes(part.name)}
                                    onCheckedChange={() => handlePartToggle(part.id, part.name)}
                                  />
                                  <label 
                                    htmlFor={part.id}
                                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                  >
                                    {part.name}
                                  </label>
                                </div>
                              ))}
                              
                              {/* Add "Other" option */}
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`${category.category.toLowerCase()}-other`} 
                                  checked={customParts.find(item => 
                                    item.category === category.category && item.showInput
                                  )?.showInput || false}
                                  onCheckedChange={() => handlePartToggle(
                                    `${category.category.toLowerCase()}-other`, 
                                    t("form.other")
                                  )}
                                />
                                <label 
                                  htmlFor={`${category.category.toLowerCase()}-other`}
                                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {t("form.other")}
                                </label>
                              </div>
                              
                              {/* Custom part input */}
                              {customParts.find(item => 
                                item.category === category.category && item.showInput
                              ) && (
                                <div className="mt-2 pl-6">
                                  <div className="flex items-center space-x-2">
                                    <Input 
                                      placeholder={t("form.customPart")}
                                      className="h-8 text-sm"
                                      value={customParts.find(item => item.category === category.category)?.value || ''}
                                      onChange={(e) => handleCustomPartChange(category.category, e.target.value)}
                                    />
                                    <Button 
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2"
                                      onClick={() => handleAddCustomPart(category.category)}
                                      disabled={!customParts.find(item => 
                                        item.category === category.category
                                      )?.value.trim()}
                                    >
                                      <PlusIcon className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </ScrollArea>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                <span className="text-black">*</span> {t("form.requiredFields")}
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
                  {t("form.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isDataLoading || isLoading.submit}
                  onClick={() => setResetDialogOpen(true)}
                >
                  {t("form.reset")}
                </Button>
                <Button
                  onClick={handleSubmit} 
                  disabled={!isFormValid() || isLoading.submit}
                  className="bg-black hover:bg-gray-800 text-white"
                >
                  {isLoading.submit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditMode ? t("form.update") : t("form.submit")}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isDataLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xl ml-4">{t("loading.title")}</span>
        </div>
      ) : (
        <>
          {/* Current Month Cost and Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-4 md:mb-6">
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-emerald-900">
                  {t("summary.currentMonthCost")}
                </CardTitle>
                <CreditCard className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold text-emerald-900">{currentMonthCost.toLocaleString()} Kz</div>
                <p className="text-xs text-emerald-700">
                  {t("summary.totalExpensesFor")} {new Date().toLocaleString('default', { month: 'long' })} {new Date().getFullYear()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("summary.totalRecords")}
                </CardTitle>
                <WrenchIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold">{records.length}</div>
                <p className="text-xs text-muted-foreground">
                  {t("summary.lifetimeRecords")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("summary.completedThisMonth")}
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold">{completedMonthRecords.length}</div>
                <p className="text-xs text-muted-foreground">
                  {currentMonthRecords.length} {t("summary.recordsThisMonth")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("summary.upcomingScheduled")}
                </CardTitle>
                <CalendarIcon className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold">{upcomingMaintenance}</div>
                <p className="text-xs text-muted-foreground">
                  {t("summary.pendingActivities")}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b">
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                    <Button 
                      variant={activeTab === "all" ? "default" : "outline"}
                      onClick={() => setActiveTab("all")}
                      className={`h-9 ${activeTab === "all" ? "bg-black hover:bg-gray-800 text-white" : ""}`}
                    >
                      {t("filters.allRecords")}
                    </Button>
                    <Button
                      variant={activeTab === "scheduled" ? "default" : "outline"}
                      onClick={() => setActiveTab("scheduled")}
                      className={`h-9 ${activeTab === "scheduled" ? "bg-black hover:bg-gray-800 text-white" : ""}`}
                    >
                      {t("filters.scheduledOnly")}
                    </Button>
                  </div>
                  
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
                      placeholder={t("filters.searchPlaceholder")}
                      className="pl-8 h-9 w-full sm:w-[200px] lg:w-[300px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <Button variant="outline" size="sm" className="h-9" onClick={() => setFilterDialogOpen(true)}>
                    <Filter className={`h-4 w-4 mr-2 ${plateFilter !== "all" ? "text-black" : ""}`} />
                    <span className="hidden sm:inline">{t("filters.filter")}</span>
                    <span className="sm:hidden">{t("filters.filter")}</span>
                    {plateFilter !== "all" && <span className="ml-1 text-black">• {t("filters.filtered")}</span>}
                  </Button>

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
                  
                  <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
                    <DialogContent className="sm:max-w-[425px] mx-4 w-[calc(100vw-2rem)]">
                      <DialogHeader>
                        <DialogTitle>{t("filters.filterTitle")}</DialogTitle>
                        <DialogDescription>
                          {t("filters.filterDescription")}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="plateFilter">{t("filters.vehiclePlate")}</Label>
                          <Select
                            value={plateFilter}
                            onValueChange={(value) => setPlateFilter(value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("filters.selectVehicle")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{t("filters.allVehicles")}</SelectItem>
                              {vehicles.map((vehicle) => (
                                <SelectItem key={vehicle.id} value={vehicle.plate}>
                                  {vehicle.plate}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter className="flex-col sm:flex-row space-y-2 sm:space-y-0">
                        <Button variant="outline" onClick={() => {
                          setPlateFilter("all");
                          setFilterDialogOpen(false);
                        }} className="w-full sm:w-auto">
                          {t("filters.reset")}
                        </Button>
                        <Button onClick={() => setFilterDialogOpen(false)} className="w-full sm:w-auto">
                          {t("filters.applyFilter")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">{t("table.date")}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      {t("table.vehicle")}
                      {plateFilter !== "all" && (
                        <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-black/10 text-black border border-black/20">
                          {t("filters.filtered")}: {plateFilter}
                        </div>
                      )}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t("table.description")}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t("table.parts")}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t("table.technician")}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t("table.status")}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">{t("table.cost")}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">{t("table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPageRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
                        {t("table.noRecords")}
                      </td>
                    </tr>
                  ) : (
                    currentPageRecords.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm">
                          {(() => {
                            // Format the date while preserving the day
                            try {
                              // Use the date string directly without conversion if possible
                              if (record.date.includes('-')) {
                                const [year, month, day] = record.date.split('T')[0].split('-');
                                return `${month}/${day}/${year}`;
                              }
                              
                              // Parse date with workaround to avoid timezone shifts
                              const dateStr = record.date.split('T')[0]; // Get just the YYYY-MM-DD part
                              const [year, month, day] = dateStr.split('-').map(Number);
                              
                              // Month is 0-indexed in JS Date, so subtract 1
                              return `${month}/${day}/${year}`;
                            } catch (e) {
                              // Fallback to old method if there's an error
                              return new Date(record.date).toLocaleDateString();
                            }
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm">{record.vehicles?.plate || record.vehiclePlate}</td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{record.description}</td>
                        <td className="px-4 py-3 text-sm">
                          {record.parts && record.parts.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {/* Add debug info */}
                              {/* {JSON.stringify(record.parts)} */}
                              {record.parts.slice(0, 3).map((part, index) => (
                                <span 
                                  key={index} 
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                                >
                                  <WrenchIcon className="h-3 w-3 mr-1" />
                                  {part}
                                </span>
                              ))}
                              {record.parts.length > 3 && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span 
                                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 cursor-pointer"
                                      >
                                        +{record.parts.length - 3} more
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="space-y-1">
                                        {record.parts.slice(3).map((part, index) => (
                                          <div key={index} className="flex items-center">
                                            <WrenchIcon className="h-3 w-3 mr-1 text-blue-500" />
                                            {part}
                                          </div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{record.technicians?.name || record.technician}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            record.status === "Completed" 
                              ? "bg-green-100 text-green-800" 
                              : record.status === "In Progress"
                              ? "bg-blue-100 text-blue-800"
                              : record.status === "Scheduled"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {record.status === "Completed" ? (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            ) : record.status === "Scheduled" ? (
                              <Clock className="h-3 w-3 mr-1" />
                            ) : record.status === "In Progress" ? (
                              <Clock className="h-3 w-3 mr-1" />
                            ) : (
                              <AlertCircle className="h-3 w-3 mr-1" />
                            )}
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{record.cost.toLocaleString()} Kz</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEditRecord(record)}
                              className="h-8 w-8 p-0"
                            >
                              <PencilIcon className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setRecordToDelete(record.id);
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
                {/* Totals Footer Row */}
                {filteredRecords.length > 0 && (
                  <tfoot className="bg-black text-white">
                    <tr>
                      <td className="px-4 py-3 text-sm font-bold">Total</td>
                      <td className="px-4 py-3 text-sm"></td>
                      <td className="px-4 py-3 text-sm"></td>
                      <td className="px-4 py-3 text-sm"></td>
                      <td className="px-4 py-3 text-sm"></td>
                      <td className="px-4 py-3 text-sm"></td>
                      <td className="px-4 py-3 text-sm text-right font-bold">
                        AOA {filteredRecords.reduce((sum, record) => sum + (record.cost || 0), 0).toLocaleString()}.00
                      </td>
                      <td className="px-4 py-3 text-sm"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            
            {/* Mobile Card View */}
            <div className="lg:hidden">
              {currentPageRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No maintenance records found
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  {currentPageRecords.map((record) => (
                    <Card key={record.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{record.vehicles?.plate || record.vehiclePlate}</h3>
                            <p className="text-sm text-muted-foreground">
                              {(() => {
                                try {
                                  if (record.date.includes('-')) {
                                    const [year, month, day] = record.date.split('T')[0].split('-');
                                    return `${month}/${day}/${year}`;
                                  }
                                  const dateStr = record.date.split('T')[0];
                                  const [year, month, day] = dateStr.split('-').map(Number);
                                  return `${month}/${day}/${year}`;
                                } catch (e) {
                                  return new Date(record.date).toLocaleDateString();
                                }
                              })()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEditRecord(record)}
                              className="h-8 w-8 p-0"
                            >
                              <PencilIcon className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setRecordToDelete(record.id);
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
                            <p className="text-sm font-medium text-gray-700">Description</p>
                            <p className="text-sm text-gray-600">{record.description}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-gray-700">Status</p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                record.status === "Completed" 
                                  ? "bg-green-100 text-green-800" 
                                  : record.status === "In Progress"
                                  ? "bg-blue-100 text-blue-800"
                                  : record.status === "Scheduled"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {record.status === "Completed" ? (
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                ) : record.status === "Scheduled" ? (
                                  <Clock className="h-3 w-3 mr-1" />
                                ) : record.status === "In Progress" ? (
                                  <Clock className="h-3 w-3 mr-1" />
                                ) : (
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                )}
                                {record.status}
                              </span>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-700">Cost</p>
                              <p className="text-sm font-semibold text-gray-900">{record.cost.toLocaleString()} Kz</p>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-700">Technician</p>
                            <p className="text-sm text-gray-600">{record.technicians?.name || record.technician}</p>
                          </div>
                          
                          {record.parts && record.parts.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Parts</p>
                              <div className="flex flex-wrap gap-1">
                                {record.parts.slice(0, 3).map((part, index) => (
                                  <span 
                                    key={index} 
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                                  >
                                    <WrenchIcon className="h-3 w-3 mr-1" />
                                    {part}
                                  </span>
                                ))}
                                {record.parts.length > 3 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                    +{record.parts.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {/* Mobile Totals Footer */}
              {filteredRecords.length > 0 && (
                <div className="p-4 bg-black text-white rounded-lg mx-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm">Total</span>
                    <span className="font-bold text-sm">
                      AOA {filteredRecords.reduce((sum, record) => sum + (record.cost || 0), 0).toLocaleString()}.00
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 border-t space-y-2 sm:space-y-0">
              <div className="text-sm text-muted-foreground text-center sm:text-left">
                Showing <span className="font-medium">{currentPageRecords.length}</span> of{" "}
                <span className="font-medium">{totalRecords}</span> records
                {plateFilter !== "all" && (
                  <span className="block sm:inline sm:ml-1">
                    (filtered by plate: <span className="font-medium">{plateFilter}</span>)
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
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
            <DialogTitle>Delete Maintenance Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this maintenance record? This action cannot be undone.
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
             <DialogTitle>Download Maintenance Records</DialogTitle>
             <DialogDescription>
               Select a date range to download maintenance records as Excel file.
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
                 exportToExcel(records.filter(r => {
                   const recordDate = new Date(r.date);
                   const isFromDate = from ? recordDate >= new Date(from) : true;
                   const isToDate = to ? recordDate <= new Date(to) : true;
                   return isFromDate && isToDate;
                 }), `maintenance_records_${from || 'all'}_to_${to || 'all'}.xlsx`);
                 setDownloadDialogOpen(false);
                 toast({
                   title: "Download Started",
                   description: `Downloading ${records.filter(r => {
                     const recordDate = new Date(r.date);
                     const isFromDate = from ? recordDate >= new Date(from) : true;
                     const isToDate = to ? recordDate <= new Date(to) : true;
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
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <InventoryManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
} 