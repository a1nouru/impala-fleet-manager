"use client"

import { useState, useEffect } from "react"
import { vehicleService } from "@/services/vehicleService"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, PlusCircle, PencilIcon, TrashIcon, Car, Calendar, MoreHorizontal, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { useTranslation } from "@/hooks/useTranslation"

// Vehicle interface based on the DB schema
interface Vehicle {
  id: string;
  plate: string;
  model: string;
  created_at?: string;
  updated_at?: string;
}

export default function VehiclesPage() {
  const { t } = useTranslation("common");

  // State for vehicles data
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  
  // Form state
  const [newVehicle, setNewVehicle] = useState<{
    plate: string;
    model: string;
  }>({
    plate: "",
    model: ""
  });
  
  const [editVehicleId, setEditVehicleId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch vehicles on component mount
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const data = await vehicleService.getVehicles();
        setVehicles(data);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
        toast({
          title: "Error",
          description: "Failed to load vehicles. Please try refreshing the page.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVehicles();
  }, []);

  // Filter vehicles based on search term
  const filteredVehicles = vehicles.filter(vehicle => 
    vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Form validation
  const validateForm = () => {
    const errors: Record<string, boolean> = {};
    
    if (!newVehicle.plate.trim()) {
      errors.plate = true;
    }
    
    if (!newVehicle.model.trim()) {
      errors.model = true;
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setNewVehicle(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: false }));
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (isEditMode && editVehicleId) {
        // Update existing vehicle
        await vehicleService.updateVehicle(editVehicleId, newVehicle);
        toast({
          title: "Success",
          description: "Vehicle updated successfully"
        });
      } else {
        // Create new vehicle
        await vehicleService.createVehicle(newVehicle);
        toast({
          title: "Success",
          description: "Vehicle added successfully"
        });
      }
      
      // Refresh the vehicles list
      const updatedVehicles = await vehicleService.getVehicles();
      setVehicles(updatedVehicles);
      
      // Reset form and close dialog
      resetForm();
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving vehicle:", error);
      toast({
        title: "Error",
        description: isEditMode 
          ? "Failed to update vehicle. Please try again."
          : "Failed to add vehicle. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit vehicle
  const handleEditVehicle = (vehicle: Vehicle) => {
    setIsEditMode(true);
    setEditVehicleId(vehicle.id);
    
    setNewVehicle({
      plate: vehicle.plate,
      model: vehicle.model,
    });
    
    setDialogOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!vehicleToDelete) return;
    
    try {
      await vehicleService.deleteVehicle(vehicleToDelete);
      
      // Refresh the vehicles list
      const updatedVehicles = await vehicleService.getVehicles();
      setVehicles(updatedVehicles);
      
      toast({
        title: "Success",
        description: "Vehicle deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      toast({
        title: "Error",
        description: "Failed to delete vehicle. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setVehicleToDelete(null);
    }
  };

  // Reset form function
  const resetForm = () => {
    setNewVehicle({
      plate: "",
      model: ""
    });
    setFormErrors({});
    setIsEditMode(false);
    setEditVehicleId(null);
  };

  // Handle dialog open change
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-4 text-lg">Loading vehicles...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <h1 className="text-xl md:text-2xl font-semibold text-gray-800">{t('vehicles.title')}</h1>
        
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              {t('vehicles.addVehicle')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] mx-4 w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {isEditMode ? "Edit Vehicle" : "Add New Vehicle"}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {isEditMode 
                  ? "Update the vehicle details below."
                  : "Enter the details for the new vehicle."
                }
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="plate" className="text-sm">
                  License Plate <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="plate"
                  name="plate"
                  placeholder="e.g., ABC-123"
                  value={newVehicle.plate}
                  onChange={handleInputChange}
                  className={formErrors.plate ? "border-red-500" : ""}
                />
                {formErrors.plate && (
                  <p className="text-xs text-red-500">License plate is required</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="model" className="text-sm">
                  Vehicle Model <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="model"
                  name="model"
                  placeholder="e.g., Toyota Hiace"
                  value={newVehicle.model}
                  onChange={handleInputChange}
                  className={formErrors.model ? "border-red-500" : ""}
                />
                {formErrors.model && (
                  <p className="text-xs text-red-500">Vehicle model is required</p>
                )}
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row space-y-2 sm:space-y-0">
              <Button 
                variant="outline" 
                onClick={() => setDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="bg-black hover:bg-gray-800 text-white w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditMode ? "Updating..." : "Adding..."}
                  </>
                ) : (
                  isEditMode ? "Update Vehicle" : "Add Vehicle"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder={t('vehicles.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Vehicles Grid */}
      {filteredVehicles.length === 0 ? (
        <div className="text-center py-12">
          <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? "No vehicles found" : "No vehicles yet"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm 
              ? "Try adjusting your search terms"
              : "Get started by adding your first vehicle"
            }
          </p>
          {!searchTerm && (
            <Button 
              onClick={() => setDialogOpen(true)}
              className="bg-black hover:bg-gray-800 text-white"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Vehicle
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {filteredVehicles.map((vehicle) => (
            <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold">
                  {vehicle.plate}
                </CardTitle>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditVehicle(vehicle)}
                    className="h-8 w-8 p-0"
                  >
                    <PencilIcon className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setVehicleToDelete(vehicle.id);
                      setDeleteDialogOpen(true);
                    }}
                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Car className="h-4 w-4 mr-2" />
                    {vehicle.model}
                  </div>
                  {vehicle.created_at && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      Added {new Date(vehicle.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="mx-4 w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Delete Vehicle</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this vehicle? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row space-y-2 sm:space-y-0">
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              className="w-full sm:w-auto"
            >
              Delete Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 