"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { 
  CalendarIcon, 
  Car, 
  DollarSign, 
  Receipt, 
  Plus, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  Check,
  ReceiptText
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/context/AuthContext";
import { rentalService } from "@/services/rentalService";
import { vehicleService } from "@/services/vehicleService";

interface CreateRentalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRentalCreated: () => void;
}

interface Vehicle {
  id: string;
  plate: string;
  model: string;
}

interface SelectedVehicle {
  id: string;
  plate: string;
  model: string;
  pricePerDay: number;
  totalDays: number;
  totalPrice: number;
}

interface RentalExpenseForm {
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  receipt_file?: File;
}

interface ReceiptForm {
  file: File;
  amount: number;
  payment_method: string;
}

const EXPENSE_CATEGORIES = [
  { value: "fuel", label: "⛽ Fuel", icon: "⛽" },
  { value: "driver", label: "👨‍💼 Driver Payment", icon: "👨‍💼" },
  { value: "meals", label: "🍽️ Meals", icon: "🍽️" },
  { value: "tolls", label: "🛣️ Tolls", icon: "🛣️" },
  { value: "cleaning", label: "🧽 Cleaning", icon: "🧽" },
  { value: "maintenance", label: "🔧 Maintenance", icon: "🔧" },
  { value: "other", label: "📝 Other", icon: "📝" }
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" }
];

export function CreateRentalDialog({ open, onOpenChange, onRentalCreated }: CreateRentalDialogProps) {
  const { t } = useTranslation('financials');
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    rental_start_date: addDays(new Date(), 1),
    rental_end_date: addDays(new Date(), 3),
    client_name: "",
    client_contact: "",
    description: "",
  });

  const [selectedVehicles, setSelectedVehicles] = useState<SelectedVehicle[]>([]);
  const [expenses, setExpenses] = useState<RentalExpenseForm[]>([]);
  const [receipts, setReceipts] = useState<ReceiptForm[]>([]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setFormData({
        rental_start_date: addDays(new Date(), 1),
        rental_end_date: addDays(new Date(), 3),
        client_name: "",
        client_contact: "",
        description: "",
      });
      setSelectedVehicles([]);
      setExpenses([]);
      setReceipts([]);
      loadAllVehicles();
    }
  }, [open]);

  // Load all vehicles from Supabase
  const loadAllVehicles = async () => {
    setIsLoadingVehicles(true);
    try {
      const vehicles = await vehicleService.getVehicles();
      setAllVehicles(vehicles);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      toast({
        title: "Error",
        description: "Failed to load vehicles",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVehicles(false);
    }
  };

  // Calculate rental duration in days
  const calculateRentalDays = () => {
    if (!formData.rental_start_date || !formData.rental_end_date) return 0;
    const diffTime = Math.abs(formData.rental_end_date.getTime() - formData.rental_start_date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calculate total rental amount from selected vehicles
  const calculateTotalRentalAmount = () => {
    return selectedVehicles.reduce((sum, vehicle) => sum + vehicle.totalPrice, 0);
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;
    
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateStep1 = () => {
    if (!formData.client_name.trim()) {
      toast({
        title: t("messages.validationError"),
        description: t("rental.enterClientName"),
        variant: "destructive",
      });
      return false;
    }
    if (!formData.rental_start_date || !formData.rental_end_date) {
      toast({
        title: t("messages.validationError"),
        description: t("rental.selectValidDateRange"),
        variant: "destructive",
      });
      return false;
    }
    if (formData.rental_start_date >= formData.rental_end_date) {
      toast({
        title: t("messages.validationError"),
        description: "End date must be after start date",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (selectedVehicles.length === 0) {
      toast({
        title: t("messages.validationError"),
        description: t("rental.selectAtLeastOneVehicle"),
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    const totalAmount = calculateTotalRentalAmount();
    if (totalAmount <= 0) {
      toast({
        title: t("messages.validationError"),
        description: "Please set prices for selected vehicles",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const addVehicleToRental = () => {
    if (allVehicles.length === 0) return;
    
    // Find vehicles not already selected
    const availableVehicles = allVehicles.filter(vehicle => 
      !selectedVehicles.find(selected => selected.id === vehicle.id)
    );
    
    if (availableVehicles.length === 0) {
      toast({
        title: "All vehicles selected",
        description: "All available vehicles are already selected for this rental",
        variant: "default",
      });
      return;
    }

    // Add the first available vehicle with default price
    const vehicleToAdd = availableVehicles[0];
    const rentalDays = calculateRentalDays();
    
    setSelectedVehicles(prev => [...prev, {
      id: vehicleToAdd.id,
      plate: vehicleToAdd.plate,
      model: vehicleToAdd.model,
      pricePerDay: 0,
      totalDays: rentalDays,
      totalPrice: 0,
    }]);
  };

  const updateVehiclePrice = (vehicleId: string, pricePerDay: number) => {
    setSelectedVehicles(prev => prev.map(vehicle => 
      vehicle.id === vehicleId 
        ? { 
            ...vehicle, 
            pricePerDay,
            totalPrice: pricePerDay * vehicle.totalDays
          }
        : vehicle
    ));
  };

  const removeVehicleFromRental = (vehicleId: string) => {
    setSelectedVehicles(prev => prev.filter(vehicle => vehicle.id !== vehicleId));
  };

  const changeSelectedVehicle = (oldVehicleId: string, newVehicleId: string) => {
    const newVehicle = allVehicles.find(v => v.id === newVehicleId);
    if (!newVehicle) return;

    setSelectedVehicles(prev => prev.map(vehicle => 
      vehicle.id === oldVehicleId 
        ? {
            id: newVehicle.id,
            plate: newVehicle.plate,
            model: newVehicle.model,
            pricePerDay: vehicle.pricePerDay,
            totalDays: vehicle.totalDays,
            totalPrice: vehicle.pricePerDay * vehicle.totalDays,
          }
        : vehicle
    ));
  };

  // Update total days when date range changes
  useEffect(() => {
    const rentalDays = calculateRentalDays();
    setSelectedVehicles(prev => prev.map(vehicle => ({
      ...vehicle,
      totalDays: rentalDays,
      totalPrice: vehicle.pricePerDay * rentalDays,
    })));
  }, [formData.rental_start_date, formData.rental_end_date]);

  const addExpense = () => {
    setExpenses(prev => [...prev, {
      category: "",
      description: "",
      amount: 0,
      expense_date: format(formData.rental_start_date, "yyyy-MM-dd"),
    }]);
  };

  const updateExpense = (index: number, field: keyof RentalExpenseForm, value: any) => {
    setExpenses(prev => prev.map((expense, i) => 
      i === index ? { ...expense, [field]: value } : expense
    ));
  };

  const removeExpense = (index: number) => {
    setExpenses(prev => prev.filter((_, i) => i !== index));
  };

  const addReceipt = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: t("messages.validationError"),
            description: t("messages.fileTooLarge"),
            variant: "destructive",
          });
          return;
        }

        setReceipts(prev => [...prev, {
          file,
          amount: 0,
          payment_method: "cash",
        }]);
      }
    };
    input.click();
  };

  const updateReceipt = (index: number, field: keyof ReceiptForm, value: any) => {
    setReceipts(prev => prev.map((receipt, i) => 
      i === index ? { ...receipt, [field]: value } : receipt
    ));
  };

  const removeReceipt = (index: number) => {
    setReceipts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    setIsSubmitting(true);
    try {
      // Prepare rental data
      const totalRentalAmount = calculateTotalRentalAmount();
      const rentalData = {
        rental_start_date: formData.rental_start_date.toISOString(),
        rental_end_date: formData.rental_end_date.toISOString(),
        rental_amount: totalRentalAmount,
        client_name: formData.client_name,
        client_contact: formData.client_contact || undefined,
        description: formData.description || undefined,
        status: 'active' as const,
        created_by: user?.email,
      };

      // Prepare vehicle IDs
      const vehicleIds = selectedVehicles.map(vehicle => vehicle.id);

      // Prepare expenses
      const expenseData = expenses.filter(expense => 
        expense.category && expense.amount > 0
      );

      // Prepare receipts
      const receiptData = receipts.map(receipt => ({
        file: receipt.file,
        amount: receipt.amount > 0 ? receipt.amount : undefined,
        payment_method: receipt.payment_method,
      }));

      // Create the rental with all associated data
      console.log('Creating rental with data:', { rentalData, vehicleIds, expenseData, receiptData });
      const createdRental = await rentalService.createVehicleRentalComplete(
        rentalData,
        vehicleIds,
        expenseData,
        receiptData
      );
      console.log('Rental created successfully:', createdRental);

      toast({
        title: t("messages.success"),
        description: t("rental.rentalCreated"),
      });

      // Add a small delay to ensure database transaction is committed
      setTimeout(() => {
        onRentalCreated();
      }, 500);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating rental:', error);
      toast({
        title: t("messages.error"),
        description: t("rental.errorCreatingRental"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotalExpenses = () => {
    return expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  };

  const calculateTotalReceiptAmount = () => {
    return receipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return "Basic Information";
      case 2: return "Select Vehicles";
      case 3: return "Financial Details";
      case 4: return "Review & Confirm";
      default: return "";
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Date Range */}
            <div>
              <Label className="text-sm font-medium">{t("rental.rentalPeriod")}</Label>
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-2">
                <div>
                  <Label className="text-xs text-gray-500">{t("rental.fromDate")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.rental_start_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.rental_start_date ? (
                          format(formData.rental_start_date, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.rental_start_date}
                        onSelect={(date) => date && setFormData(prev => ({ ...prev, rental_start_date: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">{t("rental.toDate")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.rental_end_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.rental_end_date ? (
                          format(formData.rental_end_date, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.rental_end_date}
                        onSelect={(date) => date && setFormData(prev => ({ ...prev, rental_end_date: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Client Information and Description */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <Label className="text-sm font-medium mb-4 block">{t("rental.clientInformation")}</Label>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-gray-500">{t("rental.clientName")} *</Label>
                    <Input
                      placeholder="Enter client name"
                      value={formData.client_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">{t("rental.clientContact")}</Label>
                    <Input
                      placeholder="Phone or email (optional)"
                      value={formData.client_contact}
                      onChange={(e) => setFormData(prev => ({ ...prev, client_contact: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-4 block">Description (Optional)</Label>
                <Textarea
                  placeholder="Wedding, corporate event, transportation details, etc."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="resize-none h-[120px]"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        const rentalDays = calculateRentalDays();
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">{t("rental.selectVehicles")}</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Rental duration: {rentalDays} {rentalDays === 1 ? 'day' : 'days'} 
                  ({format(formData.rental_start_date, "MMM dd")} - {format(formData.rental_end_date, "MMM dd, yyyy")})
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addVehicleToRental}
                disabled={isLoadingVehicles || allVehicles.length === selectedVehicles.length}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Vehicle
              </Button>
            </div>

            {isLoadingVehicles ? (
              <div className="text-center py-8">
                <div className="text-gray-500">Loading vehicles...</div>
              </div>
            ) : selectedVehicles.length === 0 ? (
              <div className="text-center py-8">
                <Car className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No vehicles selected</h3>
                <p className="mt-1 text-sm text-gray-500">Click "Add Vehicle" to select vehicles for this rental.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedVehicles.map((selectedVehicle, index) => {
                  // Find available vehicles for this selection (exclude already selected ones except current)
                  const availableForThis = allVehicles.filter(vehicle => 
                    vehicle.id === selectedVehicle.id || 
                    !selectedVehicles.find(selected => selected.id === vehicle.id)
                  );

                  return (
                    <Card key={selectedVehicle.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-sm font-medium">Vehicle {index + 1}</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVehicleFromRental(selectedVehicle.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                          <div>
                            <Label className="text-xs text-gray-500">Vehicle</Label>
                            <Select 
                              value={selectedVehicle.id} 
                              onValueChange={(newVehicleId) => changeSelectedVehicle(selectedVehicle.id, newVehicleId)}
                            >
                              <SelectTrigger>
                                <SelectValue>
                                  <div className="flex items-center gap-2">
                                    <Car className="h-4 w-4" />
                                    <span className="font-medium">{selectedVehicle.plate}</span>
                                  </div>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {availableForThis.map((vehicle) => (
                                  <SelectItem key={vehicle.id} value={vehicle.id}>
                                    <div className="flex items-center gap-2">
                                      <Car className="h-4 w-4" />
                                      <span className="font-medium">{vehicle.plate}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label className="text-xs text-gray-500">Price per Day (AOA)</Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input
                                type="number"
                                placeholder="0"
                                value={selectedVehicle.pricePerDay || ""}
                                onChange={(e) => updateVehiclePrice(selectedVehicle.id, parseFloat(e.target.value) || 0)}
                                className="pl-10"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-xs text-gray-500">Total Price</Label>
                            <div className="p-2 bg-blue-50 border border-blue-200 rounded-md text-sm font-medium text-blue-700">
                              {selectedVehicle.totalPrice.toLocaleString()} AOA
                              <div className="text-xs text-blue-600">
                                {selectedVehicle.pricePerDay.toLocaleString()} × {rentalDays} days
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {selectedVehicles.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium">Total Rental Amount</div>
                      <div className="text-xs text-gray-500">
                        {selectedVehicles.length} {selectedVehicles.length === 1 ? 'vehicle' : 'vehicles'} for {rentalDays} {rentalDays === 1 ? 'day' : 'days'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {calculateTotalRentalAmount().toLocaleString()} AOA
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 3:
        const totalRentalAmount = calculateTotalRentalAmount();
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
            {/* Left Column - Financial Details */}
            <div className="space-y-6 overflow-y-auto">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Details</h3>
                
                {/* Total Revenue Display */}
                <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm text-green-700 font-medium mb-1">Total Rental Revenue</div>
                  <div className="text-2xl font-bold text-green-800">
                    {totalRentalAmount.toLocaleString()} AOA
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {selectedVehicles.length} {selectedVehicles.length === 1 ? 'vehicle' : 'vehicles'} × {calculateRentalDays()} {calculateRentalDays() === 1 ? 'day' : 'days'}
                  </div>
                </div>



                {/* Upload Receipt Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium text-gray-700">Upload Receipts</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={addReceipt}
                      className="text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {receipts.map((receipt, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Receipt {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeReceipt(index)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-gray-500">Receipt File</Label>
                          <Input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) updateReceipt(index, 'file', file);
                            }}
                            className="text-xs"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-gray-500">Amount (AOA)</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={receipt.amount || ""}
                              onChange={(e) => updateReceipt(index, 'amount', parseFloat(e.target.value) || 0)}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Payment Method</Label>
                            <Select value={receipt.payment_method} onValueChange={(value) => updateReceipt(index, 'payment_method', value)}>
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_METHODS.map((method) => (
                                  <SelectItem key={method.value} value={method.value}>
                                    {method.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Expenses */}
            <div className="space-y-6 overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Expenses</h3>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={addExpense}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>

                {expenses.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Trash2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <div className="text-gray-500 text-sm">No expenses added yet</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {expenses.map((expense, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-medium text-gray-900">
                            {expense.category || `Expense ${index + 1}`}
                          </div>
                          <div className="text-lg font-semibold text-gray-900">
                            AOA {expense.amount?.toLocaleString() || '0.00'}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <Label className="text-xs text-gray-500">Category</Label>
                            <Select value={expense.category} onValueChange={(value) => updateExpense(index, 'category', value)}>
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {EXPENSE_CATEGORIES.map((category) => (
                                  <SelectItem key={category.value} value={category.value}>
                                    {category.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Amount (AOA)</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={expense.amount || ""}
                              onChange={(e) => updateExpense(index, 'amount', parseFloat(e.target.value) || 0)}
                              className="text-sm"
                            />
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <Label className="text-xs text-gray-500">Description</Label>
                          <Input
                            placeholder="Optional description"
                            value={expense.description}
                            onChange={(e) => updateExpense(index, 'description', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        
                        <div>
                          <Label className="text-xs text-gray-500">Date</Label>
                          <Input
                            type="date"
                            value={expense.expense_date}
                            onChange={(e) => updateExpense(index, 'expense_date', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 flex-1 overflow-y-auto">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Review Your Rental</h3>
              <p className="text-gray-600 mt-2">Please review all details before creating the rental</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Rental Details */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Rental Information</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Client Name</Label>
                        <div className="text-base font-semibold text-gray-900">{formData.client_name}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Contact</Label>
                        <div className="text-base text-gray-900">{formData.client_contact || 'Not provided'}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Start Date</Label>
                        <div className="text-base font-semibold text-gray-900">{format(formData.rental_start_date, "MMM dd, yyyy")}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">End Date</Label>
                        <div className="text-base font-semibold text-gray-900">{format(formData.rental_end_date, "MMM dd, yyyy")}</div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Duration</Label>
                      <div className="text-base font-semibold text-gray-900">{calculateRentalDays()} days</div>
                    </div>
                    {formData.description && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Description</Label>
                        <div className="text-base text-gray-900">{formData.description}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Selected Vehicles</h3>
                  <div className="space-y-3">
                    {selectedVehicles.map((vehicle) => (
                      <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-gray-900">{vehicle.plate}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">{vehicle.totalPrice.toLocaleString()} AOA</div>
                            <div className="text-sm text-gray-500">{vehicle.pricePerDay.toLocaleString()} AOA/day</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Financial Summary */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Total Revenue</span>
                        <span className="text-xl font-bold text-gray-900">
                          {calculateTotalRentalAmount().toLocaleString()} AOA
                        </span>
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Total Expenses</span>
                        <span className="text-xl font-bold text-gray-900">
                          {calculateTotalExpenses().toLocaleString()} AOA
                        </span>
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4 bg-green-50">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-green-800">Net Profit</span>
                        <span className="text-2xl font-bold text-green-800">
                          {(calculateTotalRentalAmount() - calculateTotalExpenses()).toLocaleString()} AOA
                        </span>
                      </div>
                      <div className="text-xs text-green-600 mt-1 text-right">
                        {calculateTotalRentalAmount() > 0 ? ((calculateTotalRentalAmount() - calculateTotalExpenses()) / calculateTotalRentalAmount() * 100).toFixed(1) : 0}% margin
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Vehicles Selected</span>
                      <span className="font-medium">{selectedVehicles.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Rental Duration</span>
                      <span className="font-medium">{calculateRentalDays()} days</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Payment Receipts</span>
                      <span className="font-medium">{receipts.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-600">Expense Items</span>
                      <span className="font-medium">{expenses.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] h-[90vh] max-w-none overflow-hidden md:w-[75vw] md:h-[85vh]">
        <DialogHeader>
          <DialogTitle>{t("rental.newRentalTitle")}</DialogTitle>
          <DialogDescription>
            Step {currentStep} of 4: {getStepTitle()}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${(currentStep / 4) * 100}%` }}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {renderStepContent()}
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button
              variant="outline"
              onClick={currentStep === 1 ? () => onOpenChange(false) : handleBack}
              disabled={isSubmitting}
            >
              {currentStep === 1 ? (
                <>{t("buttons.cancel")}</>
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </>
              )}
            </Button>

            <Button
              onClick={currentStep === 4 ? handleSubmit : handleNext}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                "Creating..."
              ) : currentStep === 4 ? (
                t("rental.createRental")
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
