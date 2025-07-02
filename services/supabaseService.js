import { createClient } from '@/lib/supabase/client';

const supabaseClient = createClient();

// Vehicle related operations
export const vehicleService = {
  // Fetch all vehicles
  getVehicles: async () => {
    try {
      const { data, error } = await supabaseClient
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      throw error;
    }
  },
  
  // Get a single vehicle by ID
  getVehicleById: async (id) => {
    try {
      const { data, error } = await supabaseClient
        .from('vehicles')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error fetching vehicle with ID ${id}:`, error);
      throw error;
    }
  },
  
  // Create a new vehicle
  createVehicle: async (vehicleData) => {
    try {
      const { data, error } = await supabaseClient
        .from('vehicles')
        .insert(vehicleData)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }
  },
  
  // Update an existing vehicle
  updateVehicle: async (id, vehicleData) => {
    try {
      const { data, error } = await supabaseClient
        .from('vehicles')
        .update(vehicleData)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error updating vehicle with ID ${id}:`, error);
      throw error;
    }
  },
  
  // Delete a vehicle
  deleteVehicle: async (id) => {
    try {
      const { error } = await supabaseClient
        .from('vehicles')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`Error deleting vehicle with ID ${id}:`, error);
      throw error;
    }
  }
};

// Maintenance record operations
export const maintenanceService = {
  // Fetch all maintenance records
  getMaintenanceRecords: async () => {
    try {
      const { data, error } = await supabaseClient
        .from('maintenance_records')
        .select(`
          *,
          vehicles:vehicle_id (plate, model),
          technicians:technician_id (name)
        `)
        .order('date', { ascending: false });
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching maintenance records:', error);
      throw error;
    }
  },
  
  // Create a new maintenance record
  createMaintenanceRecord: async (recordData) => {
    try {
      const { data, error } = await supabaseClient
        .from('maintenance_records')
        .insert(recordData)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating maintenance record:', error);
      throw error;
    }
  },
  
  // Update an existing maintenance record
  updateMaintenanceRecord: async (id, recordData) => {
    try {
      const { data, error } = await supabaseClient
        .from('maintenance_records')
        .update(recordData)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error updating maintenance record with ID ${id}:`, error);
      throw error;
    }
  },
  
  // Delete a maintenance record
  deleteMaintenanceRecord: async (id) => {
    try {
      const { error } = await supabaseClient
        .from('maintenance_records')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`Error deleting maintenance record with ID ${id}:`, error);
      throw error;
    }
  }
};

// Authentication operations are now handled by AuthContext and middleware
// export const authService = { ... } 