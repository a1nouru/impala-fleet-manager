"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Edit, 
  Trash2, 
  AlertTriangle,
  DollarSign,
  Users,
  TrendingDown,
  Calculator,
  CalendarIcon,
  Upload,
  X,
  FileText,
  ExternalLink
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { hrService, VehicleDamage, Employee, DamageSummary } from "@/services/hrService";
import { vehicleService } from "@/services/vehicleService";

// Helper to format currency
const formatCurrency = (value: number) => {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "AOA",
  });
};

interface Vehicle {
  id: string;
  plate: string;
}

export default function VehicleDamagesPage() {
  const [damages, setDamages] = useState<VehicleDamage[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summary, setSummary] = useState<DamageSummary>({
    total_damages_value: 0,
    total_deductions_this_month: 0,
    active_damages_count: 0,
    employees_with_damages_count: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog states
  const [newDamageDialogOpen, setNewDamageDialogOpen] = useState(false);
  const [editDamageDialogOpen, setEditDamageDialogOpen] = useState(false);
  const [editingDamage, setEditingDamage] = useState<VehicleDamage | null>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [damageToDelete, setDamageToDelete] = useState<VehicleDamage | null>(null);

  // Date filter states
  const [dateFilter, setDateFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Form states
  const [newDamage, setNewDamage] = useState({
    employee_id: "",
    vehicle_id: "",
    damage_description: "",
    total_damage_cost: 0,
    monthly_deduction_percentage: 10, // Default to 10%
    damage_date: format(new Date(), "yyyy-MM-dd"),
  });

  const [editedDamage, setEditedDamage] = useState({
    employee_id: "",
    vehicle_id: "",
    damage_description: "",
    total_damage_cost: 0,
    monthly_deduction_percentage: 10,
    damage_date: "",
  });

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [editUploadedFiles, setEditUploadedFiles] = useState<File[]>([]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      console.log("🔄 Starting HR data fetch...");
      
      // Fetch data sequentially to better debug issues
      console.log("📋 Fetching employees...");
      const employeesData = await hrService.getActiveEmployees();
      console.log("✅ Employees fetched:", employeesData.length);
      
      console.log("🚗 Fetching vehicles...");
      const vehiclesData = await vehicleService.getVehicles();
      console.log("✅ Vehicles fetched:", vehiclesData.length);
      
      console.log("⚠️ Fetching damage summary...");
      const summaryData = await hrService.getCurrentMonthDamageSummary();
      console.log("✅ Summary fetched:", summaryData);
      
      console.log("🔧 Fetching vehicle damages...");
      const damagesData = await hrService.getVehicleDamages();
      console.log("✅ Damages fetched:", damagesData.length);
      
      setEmployees(employeesData);
      setVehicles(vehiclesData || []);
      setSummary(summaryData);
      setDamages(damagesData);
      
      console.log("🎉 All HR data loaded successfully");
    } catch (error) {
      console.error("❌ Error fetching HR data:", error);
      toast({
        title: "❌ Error",
        description: `Failed to load HR data: ${error.message || error}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Form handlers
  const handleInputChange = (field: string, value: string | number) => {
    setNewDamage(prev => ({ 
      ...prev, 
      [field]: field.includes('cost') || field.includes('percentage') ? Number(value) || 0 : value 
    }));
  };

  const handleEditInputChange = (field: string, value: string | number) => {
    setEditedDamage(prev => ({ 
      ...prev, 
      [field]: field.includes('cost') || field.includes('percentage') ? Number(value) || 0 : value 
    }));
  };

  const resetForm = () => {
    setNewDamage({
      employee_id: "",
      vehicle_id: "",
      damage_description: "",
      total_damage_cost: 0,
      monthly_deduction_percentage: 10,
      damage_date: format(new Date(), "yyyy-MM-dd"),
    });
    setUploadedFiles([]);
  };

  // File upload handlers
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const handleEditFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setEditUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number, isEdit: boolean = false) => {
    if (isEdit) {
      setEditUploadedFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    if (!newDamage.employee_id || !newDamage.vehicle_id || !newDamage.damage_description || newDamage.total_damage_cost <= 0) {
      toast({
        title: "❌ Validation Error",
        description: "Please fill out all required fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    if (newDamage.monthly_deduction_percentage < 1 || newDamage.monthly_deduction_percentage > 30) {
      toast({
        title: "❌ Validation Error",
        description: "Monthly deduction percentage must be between 1% and 30%.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await hrService.createVehicleDamage(newDamage);
      toast({
        title: "✅ Success",
        description: "Vehicle damage entry created successfully.",
      });
      setNewDamageDialogOpen(false);
      resetForm();
      fetchData(); // Refresh data
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to create damage entry.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (damage: VehicleDamage) => {
    setEditingDamage(damage);
    setEditedDamage({
      employee_id: damage.employee_id,
      vehicle_id: damage.vehicle_id,
      damage_description: damage.damage_description,
      total_damage_cost: damage.total_damage_cost,
      monthly_deduction_percentage: damage.monthly_deduction_percentage,
      damage_date: damage.damage_date,
    });
    setEditDamageDialogOpen(true);
  };

  const handleUpdateDamage = async () => {
    if (!editingDamage) return;

    if (editedDamage.monthly_deduction_percentage < 1 || editedDamage.monthly_deduction_percentage > 30) {
      toast({
        title: "❌ Validation Error",
        description: "Monthly deduction percentage must be between 1% and 30%.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await hrService.updateVehicleDamage(editingDamage.id, editedDamage);
      toast({
        title: "✅ Success",
        description: "Damage entry updated successfully.",
      });
      setEditDamageDialogOpen(false);
      fetchData(); // Refresh data
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to update damage entry.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (damage: VehicleDamage) => {
    setDamageToDelete(damage);
    setDeleteConfirmationOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!damageToDelete) return;
    setIsSubmitting(true);
    try {
      await hrService.deleteVehicleDamage(damageToDelete.id);
      toast({
        title: "✅ Success",
        description: "Damage entry deleted successfully.",
      });
      fetchData(); // Refresh data
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to delete damage entry.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmationOpen(false);
      setDamageToDelete(null);
    }
  };

  const handleViewDocuments = (damage: VehicleDamage) => {
    if (!damage.document_urls || damage.document_urls.length === 0) {
      toast({
        title: "No Documents",
        description: "No documents have been uploaded for this damage entry.",
        variant: "default",
      });
      return;
    }

    // Open each document in a new tab
    damage.document_urls.forEach((url, index) => {
      const fileName = damage.document_names?.[index] || `Document ${index + 1}`;
      window.open(url, '_blank');
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Vehicle Damages
          </h1>
          <Badge variant="outline">{damages.length} total entries</Badge>
        </div>
        
        <Dialog open={newDamageDialogOpen} onOpenChange={setNewDamageDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-gray-800 text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              Log Damage
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Log Vehicle Damage</DialogTitle>
              <DialogDescription>
                Record a new vehicle damage entry with payment plan details.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee/Driver</Label>
                  <Select value={newDamage.employee_id} onValueChange={(value) => handleInputChange("employee_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vehicle</Label>
                  <Select value={newDamage.vehicle_id} onValueChange={(value) => handleInputChange("vehicle_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.plate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Damage Description</Label>
                <Textarea
                  value={newDamage.damage_description}
                  onChange={(e) => handleInputChange("damage_description", e.target.value)}
                  placeholder="Describe the damage..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Damage Cost (AOA)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newDamage.total_damage_cost}
                    onChange={(e) => handleInputChange("total_damage_cost", e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Deduction % (Max 30%)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={newDamage.monthly_deduction_percentage}
                    onChange={(e) => handleInputChange("monthly_deduction_percentage", e.target.value)}
                    placeholder="10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Damage Date</Label>
                <Input
                  type="date"
                  value={newDamage.damage_date}
                  onChange={(e) => handleInputChange("damage_date", e.target.value)}
                />
              </div>
              
              {/* Document Upload Section */}
              <div className="space-y-2">
                <Label>Upload Documents (Optional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <div className="text-center">
                      <Label htmlFor="damage-files" className="cursor-pointer text-sm text-blue-600 hover:text-blue-500">
                        Click to upload files
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        Upload photos, receipts, or documents related to the damage
                      </p>
                    </div>
                    <Input
                      id="damage-files"
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
                
                {/* Display uploaded files */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Uploaded Files:</Label>
                    <div className="space-y-1">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm truncate">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewDamageDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-black hover:bg-gray-800 text-white">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Log Damage
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Database Setup Warning */}
      {employees.length === 0 && !isLoading && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-amber-800">HR System Setup Required</h3>
                <p className="text-sm text-amber-700 mt-1">
                  The HR database tables haven't been created yet. Please run the following SQL migrations in your Supabase SQL Editor:
                </p>
                <ol className="text-sm text-amber-700 mt-2 list-decimal list-inside space-y-1">
                  <li><code className="bg-amber-100 px-1 rounded">20241221000000_create_hr_tables.sql</code></li>
                  <li><code className="bg-amber-100 px-1 rounded">20241221000001_insert_employee_data.sql</code></li>
                  <li><code className="bg-amber-100 px-1 rounded">20241221000002_create_hr_functions.sql</code></li>
                </ol>
                <p className="text-xs text-amber-600 mt-2">
                  After running the migrations, refresh this page to load your HR data.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            <CardTitle className="text-sm font-medium">Total Damages Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.total_damages_value)}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Deductions</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(summary.total_deductions_this_month)}</div>
            <p className="text-xs text-muted-foreground">To be deducted this month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Damages</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.active_damages_count}</div>
            <p className="text-xs text-muted-foreground">Unpaid damage entries</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Affected Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.employees_with_damages_count}</div>
            <p className="text-xs text-muted-foreground">Employees with damages</p>
          </CardContent>
        </Card>
      </div>

      {/* Damages Table */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : damages.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Deduction %</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Documents</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {damages.map((damage) => (
                  <TableRow key={damage.id}>
                    <TableCell>{format(parseISO(damage.damage_date), "PP")}</TableCell>
                    <TableCell>{damage.employees?.nome}</TableCell>
                    <TableCell>{damage.vehicles?.plate}</TableCell>
                    <TableCell className="max-w-xs truncate">{damage.damage_description}</TableCell>
                    <TableCell className="text-right">{formatCurrency(damage.total_damage_cost)}</TableCell>
                    <TableCell className="text-right">{damage.monthly_deduction_percentage}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(damage.remaining_balance)}</TableCell>
                    <TableCell>
                      <Badge variant={damage.is_fully_paid ? "default" : "destructive"}>
                        {damage.is_fully_paid ? "Paid" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {damage.document_urls && damage.document_urls.length > 0 ? (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-blue-600 hover:text-blue-700"
                          onClick={() => handleViewDocuments(damage)}
                          title={`View ${damage.document_urls.length} document(s)`}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(damage)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteClick(damage)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No damage entries found</p>
              <p className="text-sm">Start by logging your first vehicle damage entry.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Damage Dialog */}
      {editingDamage && (
        <Dialog open={editDamageDialogOpen} onOpenChange={setEditDamageDialogOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Edit Damage Entry</DialogTitle>
              <DialogDescription>
                Update the damage entry details and payment plan.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee/Driver</Label>
                  <Select value={editedDamage.employee_id} onValueChange={(value) => handleEditInputChange("employee_id", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vehicle</Label>
                  <Select value={editedDamage.vehicle_id} onValueChange={(value) => handleEditInputChange("vehicle_id", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.plate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Damage Description</Label>
                <Textarea
                  value={editedDamage.damage_description}
                  onChange={(e) => handleEditInputChange("damage_description", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Damage Cost (AOA)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editedDamage.total_damage_cost}
                    onChange={(e) => handleEditInputChange("total_damage_cost", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Deduction % (Max 30%)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={editedDamage.monthly_deduction_percentage}
                    onChange={(e) => handleEditInputChange("monthly_deduction_percentage", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Damage Date</Label>
                <Input
                  type="date"
                  value={editedDamage.damage_date}
                  onChange={(e) => handleEditInputChange("damage_date", e.target.value)}
                />
              </div>
              
              {/* Document Upload Section */}
              <div className="space-y-2">
                <Label>Upload Documents (Optional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <div className="text-center">
                      <Label htmlFor="edit-damage-files" className="cursor-pointer text-sm text-blue-600 hover:text-blue-500">
                        Click to upload files
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        Upload photos, receipts, or documents related to the damage
                      </p>
                    </div>
                    <Input
                      id="edit-damage-files"
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleEditFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
                
                {/* Display uploaded files */}
                {editUploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Uploaded Files:</Label>
                    <div className="space-y-1">
                      {editUploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm truncate">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index, true)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDamageDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateDamage} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Damage
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {damageToDelete && (
                `This action cannot be undone. This will permanently delete the damage entry for ${damageToDelete.employees?.nome} involving vehicle ${damageToDelete.vehicles?.plate}.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
