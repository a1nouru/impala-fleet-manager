import { createClient } from '@/lib/supabase/client';

const supabaseClient = createClient();

export const inventoryService = {
  // Get all inventory items
  getInventoryItems: async () => {
    try {
      console.log('Fetching inventory items from Supabase...');
      const { data, error } = await supabaseClient
        .from('inventory_items')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) {
        console.error('Error in getInventoryItems:', error);
        
        // Check if it's a table doesn't exist error
        if (error.code === 'PGRST106' || error.message?.includes('relation "public.inventory_items" does not exist')) {
          console.warn('inventory_items table does not exist. Please run the inventory migrations.');
          return [];
        }
        
        throw error;
      }
      
      console.log(`Fetched ${data?.length || 0} inventory items`);
      return data || [];
    } catch (error) {
      console.error('Error getting inventory items:', error);
      
      // Return empty array on any error to prevent app crash
      return [];
    }
  },

  // Get inventory item by ID
  getInventoryById: async (id) => {
    try {
      const { data, error } = await supabaseClient
        .from('inventory_items')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting inventory by ID:', error);
      return null;
    }
  },

  // Create a new inventory item
  createInventoryItem: async (item, created_by) => {
    try {
      console.log('Creating inventory item:', item);
      
      // Prepare the record with created_by if provided
      const recordToCreate = {
        ...item,
        total_cost: parseFloat(item.quantity) * parseFloat(item.amount_unit)
      };
      
      if (created_by) {
        recordToCreate.created_by = created_by;
      }
      
      const { data, error } = await supabaseClient
        .from('inventory_items')
        .insert([recordToCreate])
        .select()
        .single();
      
      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }
      
      console.log('Created inventory item:', data);
      return data;
    } catch (error) {
      console.error('Error creating inventory item:', error);
      throw error;
    }
  },

  // Create multiple inventory items in one insert
  createBulkInventoryItems: async (items, receiptUrl, created_by) => {
    try {
      if (!Array.isArray(items) || items.length === 0) {
        return [];
      }

      const recordsToCreate = items.map((item) => {
        const quantity = Number(item.quantity) || 0;
        const total_cost = Number(item.total_cost) || 0;
        const amount_unit =
          Number(item.amount_unit) ||
          (quantity > 0 && total_cost > 0 ? total_cost / quantity : 0);

        const record = {
          ...item,
          quantity,
          amount_unit,
          total_cost: total_cost > 0 ? total_cost : quantity * amount_unit,
        };

        if (receiptUrl) record.receipt_url = receiptUrl;
        if (created_by) record.created_by = created_by;

        return record;
      });

      const { data, error } = await supabaseClient
        .from("inventory_items")
        .insert(recordsToCreate)
        .select();

      if (error) {
        console.error("Supabase bulk insert error:", error);

        if (
          error.code === "PGRST106" ||
          error.message?.includes('relation "public.inventory_items" does not exist')
        ) {
          console.warn("inventory_items table does not exist. Please run the inventory migrations.");
          return [];
        }

        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Error creating bulk inventory items:", error);
      throw error;
    }
  },

  // Update an existing inventory item
  updateInventoryItem: async (id, item) => {
    try {
      console.log('Updating inventory item ID:', id);
      
      // Prepare the record with calculated total_cost
      const recordToUpdate = {
        ...item,
        total_cost: parseFloat(item.quantity) * parseFloat(item.amount_unit)
      };
      
      const { data, error } = await supabaseClient
        .from('inventory_items')
        .update(recordToUpdate)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      
      console.log('Updated inventory item:', data);
      return data;
    } catch (error) {
      console.error('Error updating inventory item:', error);
      throw error;
    }
  },

  // Delete an inventory item
  deleteInventoryItem: async (id) => {
    try {
      const { error } = await supabaseClient
        .from('inventory_items')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      throw error;
    }
  },

  // Upload receipt file to Supabase Storage
  uploadReceipt: async (file, itemId) => {
    try {
      console.log('Uploading receipt file:', file.name);
      
      // Generate a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${itemId || Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `receipts/${fileName}`;
      
      // Upload file to Supabase Storage
      const { data, error } = await supabaseClient.storage
        .from('inventory-receipts')
        .upload(filePath, file);
      
      if (error) {
        console.error('Storage upload error:', error);
        throw error;
      }
      
      // Get the public URL
      const { data: { publicUrl } } = supabaseClient.storage
        .from('inventory-receipts')
        .getPublicUrl(filePath);
      
      console.log('Receipt uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      throw error;
    }
  },

  // Delete receipt file from Supabase Storage
  deleteReceipt: async (receiptUrl) => {
    try {
      if (!receiptUrl) return true;
      
      // Extract file path from URL
      const urlParts = receiptUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `receipts/${fileName}`;
      
      const { error } = await supabaseClient.storage
        .from('inventory-receipts')
        .remove([filePath]);
      
      if (error) {
        console.error('Storage delete error:', error);
        // Don't throw error for file deletion failures
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting receipt:', error);
      return false;
    }
  }
};