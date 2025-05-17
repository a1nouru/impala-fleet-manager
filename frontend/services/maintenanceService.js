import { supabase } from '../lib/supabase'

// Initialize local storage for maintenance records if it doesn't exist
const initializeLocalStorage = () => {
  if (typeof window !== 'undefined') {
    if (!localStorage.getItem('maintenance_records')) {
      localStorage.setItem('maintenance_records', JSON.stringify([]));
    }
  }
};

export const maintenanceService = {
  // Get all maintenance records
  getMaintenanceRecords: async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_records')
        .select(`
          *,
          vehicles:vehicle_id(plate, model),
          technicians:technician_id(name)
        `)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting maintenance records:', error);
      return [];
    }
  },

  // Get maintenance record by ID with parts
  getMaintenanceById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('maintenance_records')
        .select(`
          *,
          vehicles:vehicle_id(plate, model),
          technicians:technician_id(name)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Return maintenance record with parts as an array
      // Parts column is a native Postgres text[] type
      return data;
    } catch (error) {
      console.error('Error getting maintenance by ID:', error);
      return null;
    }
  },

  // Create a new maintenance record
  createMaintenanceRecord: async (record, parts, created_by) => {
    try {
      // Use the parts array directly for the new parts column
      // Now parts contains friendly names instead of IDs
      const recordWithParts = {
        ...record,
        parts: parts || [],
        created_by
      };
      
      // Create the maintenance record
      const { data, error } = await supabase
        .from('maintenance_records')
        .insert([recordWithParts])
        .select();
      
      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }
      
      return data && data[0];
    } catch (error) {
      console.error('Error creating maintenance record:', error);
      throw error;
    }
  },

  // Update an existing maintenance record
  updateMaintenanceRecord: async (id, record, parts) => {
    try {
      // Use the parts array directly for the parts column
      const recordWithParts = {
        ...record,
        parts: parts || []
      };
      
      // Update the maintenance record
      const { data, error } = await supabase
        .from('maintenance_records')
        .update(recordWithParts)
        .eq('id', id)
        .select();
      
      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      
      return data && data[0];
    } catch (error) {
      console.error('Error updating maintenance record:', error);
      throw error;
    }
  },

  // Delete a maintenance record
  deleteMaintenanceRecord: async (id) => {
    try {
      const { error } = await supabase
        .from('maintenance_records')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting maintenance record:', error);
      throw error;
    }
  }
} 