import { supabase } from '../lib/supabase'

export const vehicleService = {
  // Get all vehicles
  getVehicles: async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('plate')
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      return [];
    }
  },

  // Get vehicle by ID
  getVehicleById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching vehicle by ID:', error);
      return null;
    }
  },

  // Create a new vehicle
  createVehicle: async (vehicle) => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .insert([vehicle])
        .select();
      
      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }
      
      return data && data[0];
    } catch (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }
  },

  // Update an existing vehicle
  updateVehicle: async (id, vehicle) => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .update(vehicle)
        .eq('id', id)
        .select();
      
      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      
      return data && data[0];
    } catch (error) {
      console.error('Error updating vehicle:', error);
      throw error;
    }
  },

  // Delete a vehicle
  deleteVehicle: async (id) => {
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      throw error;
    }
  }
} 