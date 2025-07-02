import { createClient } from '@/lib/supabase/client';

const supabaseClient = createClient();

/**
 * Vehicle service for managing vehicle data in Supabase
 */
export const vehicleService = {
  /**
   * Get all vehicles
   */
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
  
  /**
   * Get a vehicle by ID
   * @param {string} id - The vehicle ID
   */
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
  
  /**
   * Create a new vehicle
   * @param {Object} vehicleData - The vehicle data
   */
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
  
  /**
   * Update an existing vehicle
   * @param {string} id - The vehicle ID
   * @param {Object} vehicleData - The updated vehicle data
   */
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
  
  /**
   * Delete a vehicle
   * @param {string} id - The vehicle ID
   */
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
} 