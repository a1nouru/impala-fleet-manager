import { createClient } from '@/lib/supabase/client';

const supabaseClient = createClient();

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
      console.log('Fetching maintenance records from Supabase...');
      const { data, error } = await supabaseClient
        .from('maintenance_records')
        .select(`
          *,
          vehicles:vehicle_id(plate, model),
          technicians:technician_id(name)
        `)
        .order('date', { ascending: false });
      
      if (error) {
        console.error('Error in getMaintenanceRecords:', error);
        throw error;
      }
      
      // Log the first record to see what's coming back from the database
      if (data && data.length > 0) {
        console.log('Sample record:', JSON.stringify(data[0], null, 2));
        console.log('Parts in first record:', data[0].parts);
      } else {
        console.log('No maintenance records found');
      }
      
      return data || [];
    } catch (error) {
      console.error('Error getting maintenance records:', error);
      return [];
    }
  },

  // Get maintenance record by ID with parts
  getMaintenanceById: async (id) => {
    try {
      const { data, error } = await supabaseClient
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
      return data;
    } catch (error) {
      console.error('Error getting maintenance by ID:', error);
      return null;
    }
  },

  // Create a new maintenance record
  createMaintenanceRecord: async (record, parts, created_by) => {
    try {
      // Ensure parts is always an array
      const normalizedParts = Array.isArray(parts) ? parts : [];
      
      // Log what we're sending to the database
      console.log('Creating maintenance record with parts:', normalizedParts);
      console.log('Date being saved to DB:', record.date);
      
      // Use the parts array directly for the new parts column
      const recordWithParts = {
        ...record,
        parts: normalizedParts
      };
      
      if (created_by) {
        recordWithParts.created_by = created_by;
      }
      
      // Create the maintenance record
      const { data, error } = await supabaseClient
        .from('maintenance_records')
        .insert([recordWithParts])
        .select();
      
      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }
      
      // Log the created record
      if (data && data[0]) {
        console.log('Created record:', JSON.stringify(data[0], null, 2));
        console.log('Date as stored in DB:', data[0].date);
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
      // Ensure parts is always an array
      const normalizedParts = Array.isArray(parts) ? parts : [];
      
      // Log what we're updating
      console.log('Updating maintenance record ID:', id);
      console.log('With parts:', normalizedParts);
      
      // Ensure the date is properly formatted without timezone conversion
      const recordToUpdate = {
        ...record,
        parts: normalizedParts
      };
      
      // Log the actual date being sent to the database
      console.log('Date being sent to database:', recordToUpdate.date);
      
      // Update the maintenance record
      const { data, error } = await supabaseClient
        .from('maintenance_records')
        .update(recordToUpdate)
        .eq('id', id)
        .select();
      
      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      
      // Log the updated record
      if (data && data[0]) {
        console.log('Updated record:', JSON.stringify(data[0], null, 2));
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
      const { error } = await supabaseClient
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