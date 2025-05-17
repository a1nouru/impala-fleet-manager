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

// Vehicle interface based on the DB schema
interface Vehicle {
  id: string;
  plate: string;
  model: string;
  created_at?: string;
  updated_at?: string;
}

export default function VehiclesPage() {
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

  // Handle dialog open state change
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    
    if (!open) {
      resetForm();
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Vehicles</h1>
        
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button
              className="bg-primary"
              onClick={() => {
                resetForm();
                setIsEditMode(false);
              }}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit Vehicle" : "Add New Vehicle"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode 
                  ? "Update the vehicle details below."
                  : "Enter the details of the new vehicle."
                }
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="plate" className="flex items-center">
                  License Plate <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input 
                  id="plate"
                  name="plate"
                  value={newVehicle.plate}
                  onChange={handleInputChange}
                  placeholder="Enter license plate"
                  className={formErrors.plate ? "border-red-500" : ""}
                />
                {formErrors.plate && (
                  <p className="text-xs text-red-500">License plate is required</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="model" className="flex items-center">
                  Model <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input 
                  id="model"
                  name="model"
                  value={newVehicle.model}
                  onChange={handleInputChange}
                  placeholder="Enter vehicle model"
                  className={formErrors.model ? "border-red-500" : ""}
                />
                {formErrors.model && (
                  <p className="text-xs text-red-500">Model is required</p>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                <span className="text-red-500">*</span> Required fields
              </div>
            </div>
            <DialogFooter>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditMode ? "Update" : "Add"} Vehicle
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between">
            <div className="text-lg font-medium">Vehicle Fleet</div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search vehicles..."
                className="pl-8 h-9 md:w-[300px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xl ml-4">Loading vehicles...</span>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left text-sm font-medium">License Plate</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Model</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Added On</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      {vehicles.length === 0 
                        ? "No vehicles found. Add your first vehicle!" 
                        : "No vehicles match your search."}
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">{vehicle.plate}</td>
                      <td className="px-4 py-3 text-sm">{vehicle.model}</td>
                      <td className="px-4 py-3 text-sm">
                        {vehicle.created_at 
                          ? new Date(vehicle.created_at).toLocaleDateString() 
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditVehicle(vehicle)}
                            className="h-8 w-8 p-0"
                          >
                            <PencilIcon className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="outline"
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-4 py-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{filteredVehicles.length}</span> of{" "}
            <span className="font-medium">{vehicles.length}</span> vehicles
          </div>
        </div>
      </div>

      {/* Add some statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Vehicles
            </CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicles.length}</div>
            <p className="text-xs text-muted-foreground">
              Vehicles in the fleet
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Recently Added
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vehicles.length > 0 && vehicles[0].created_at
                ? new Date(vehicles[0].created_at).toLocaleDateString()
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Date of most recent vehicle addition
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Vehicle Models
            </CardTitle>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(vehicles.map(v => v.model)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Unique vehicle models in fleet
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Vehicle</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this vehicle? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 