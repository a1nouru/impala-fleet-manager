import { createClient } from '@/lib/supabase/client';
import type { VehicleRental, RentalVehicle, RentalExpense, RentalReceipt } from './financialService';

const supabase = createClient();

export const rentalService = {
  /**
   * Fetches all vehicle rentals with their associated data
   */
  async getVehicleRentals(): Promise<VehicleRental[]> {
    try {
      const { data, error } = await supabase
        .from('vehicle_rentals')
        .select(`
          *,
          rental_vehicles (
            *,
            vehicles (plate)
          ),
          rental_expenses (*),
          rental_receipts (*)
        `)
        .order('rental_start_date', { ascending: false });

      if (error) {
        console.error('Error fetching vehicle rentals:', error);
        
        // Handle table not existing yet
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          console.warn('Rental tables do not exist yet. Please run the database migration.');
          return [];
        }
        
        // Handle RLS permission errors
        if (error.message?.includes('permission denied') || 
            error.message?.includes('RLS') ||
            error.message?.includes('policy') ||
            error.code === 'PGRST301') {
          console.warn('Row Level Security policies missing for rental tables. Please run the RLS policies setup.');
          return [];
        }
        
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Error in getVehicleRentals:', error);
      
      // Handle any table not existing errors
      if (error?.message?.includes('relation') && error?.message?.includes('does not exist')) {
        console.warn('Rental tables do not exist yet. Please run the database migration.');
        return [];
      }
      
      // Handle RLS permission errors
      if (error?.message?.includes('permission denied') || 
          error?.message?.includes('RLS') ||
          error?.message?.includes('policy')) {
        console.warn('Row Level Security policies missing for rental tables. Please run the RLS policies setup.');
        return [];
      }
      
      // As absolute last resort, return empty array to prevent page crash
      console.warn('🆘 Returning empty array as fallback for rental error:', error);
      return [];
    }
  },

  /**
   * Creates a new vehicle rental
   */
  async createVehicleRental(rentalData: {
    rental_start_date: string;
    rental_end_date: string;
    rental_amount: number;
    client_name?: string;
    client_contact?: string;
    description?: string;
    status?: 'active' | 'completed' | 'cancelled';
    created_by?: string;
  }): Promise<VehicleRental> {
    const { data, error } = await supabase
      .from('vehicle_rentals')
      .insert([{ ...rentalData, status: rentalData.status || 'active' }])
      .select()
      .single();

    if (error) {
      console.error('Error creating vehicle rental:', error);
      throw error;
    }

    return data;
  },

  /**
   * Creates a vehicle rental with vehicles, expenses, and receipts
   */
  async createVehicleRentalComplete(
    rentalData: {
      rental_start_date: string;
      rental_end_date: string;
      rental_amount: number;
      client_name?: string;
      client_contact?: string;
      description?: string;
      status?: 'active' | 'completed' | 'cancelled';
      created_by?: string;
    },
    vehicleIds: string[],
    expenses: Omit<RentalExpense, 'id' | 'rental_id' | 'created_at' | 'updated_at'>[],
    receiptFiles: Array<{ file: File; amount?: number; payment_method?: string }>
  ): Promise<VehicleRental> {
    // Create the rental first
    const rental = await this.createVehicleRental(rentalData);

    // Add vehicles
    if (vehicleIds.length > 0) {
      await this.addVehiclesToRental(rental.id, vehicleIds);
    }

    // Add expenses
    if (expenses.length > 0) {
      for (const expense of expenses) {
        await this.createRentalExpense(rental.id, expense);
      }
    }

    // Add receipts
    if (receiptFiles.length > 0) {
      await this.addReceiptsToRental(rental.id, receiptFiles);
    }

    // Return the complete rental data
    return this.getVehicleRentalById(rental.id);
  },

  /**
   * Fetches a single vehicle rental by ID with all related data
   */
  async getVehicleRentalById(rentalId: string): Promise<VehicleRental> {
    const { data, error } = await supabase
      .from('vehicle_rentals')
      .select(`
        *,
        rental_vehicles (
          *,
          vehicles (plate)
        ),
        rental_expenses (*),
        rental_receipts (*)
      `)
      .eq('id', rentalId)
      .single();

    if (error) {
      console.error('Error fetching vehicle rental by ID:', error);
      throw error;
    }

    return data;
  },

  /**
   * Updates a vehicle rental
   */
  async updateVehicleRental(
    rentalId: string,
    updates: Partial<Pick<VehicleRental, 'rental_start_date' | 'rental_end_date' | 'rental_amount' | 'client_name' | 'client_contact' | 'description' | 'status'>>
  ): Promise<VehicleRental> {
    const { data, error } = await supabase
      .from('vehicle_rentals')
      .update(updates)
      .eq('id', rentalId)
      .select()
      .single();

    if (error) {
      console.error('Error updating vehicle rental:', error);
      throw error;
    }

    return data;
  },

  /**
   * Deletes a vehicle rental and all associated data
   */
  async deleteVehicleRental(rentalId: string): Promise<void> {
    // Delete rental receipts (files and records)
    const { data: receipts } = await supabase
      .from('rental_receipts')
      .select('receipt_url, id')
      .eq('rental_id', rentalId);

    if (receipts) {
      for (const receipt of receipts) {
        try {
          await this.deleteRentalReceipt(receipt.id);
        } catch (error) {
          console.warn('Error deleting rental receipt:', error);
        }
      }
    }

    // Delete rental expenses with receipts
    const { data: expenses } = await supabase
      .from('rental_expenses')
      .select('id')
      .eq('rental_id', rentalId);

    if (expenses) {
      for (const expense of expenses) {
        await this.deleteRentalExpense(expense.id);
      }
    }

    // Delete rental vehicles
    await supabase
      .from('rental_vehicles')
      .delete()
      .eq('rental_id', rentalId);

    // Delete the rental
    const { error } = await supabase
      .from('vehicle_rentals')
      .delete()
      .eq('id', rentalId);

    if (error) {
      console.error('Error deleting vehicle rental:', error);
      throw error;
    }
  },

  /**
   * Adds vehicles to a rental
   */
  async addVehiclesToRental(rentalId: string, vehicleIds: string[]): Promise<void> {
    const vehicleLinks = vehicleIds.map(vehicleId => ({
      rental_id: rentalId,
      vehicle_id: vehicleId
    }));

    const { error } = await supabase
      .from('rental_vehicles')
      .insert(vehicleLinks);

    if (error) {
      console.error('Error adding vehicles to rental:', error);
      throw error;
    }
  },

  /**
   * Creates a rental expense
   */
  async createRentalExpense(
    rentalId: string,
    expenseData: Omit<RentalExpense, 'id' | 'rental_id' | 'created_at' | 'updated_at'>
  ): Promise<RentalExpense> {
    const { data, error } = await supabase
      .from('rental_expenses')
      .insert([{ ...expenseData, rental_id: rentalId }])
      .select()
      .single();

    if (error) {
      console.error('Error creating rental expense:', error);
      throw error;
    }

    return data;
  },

  /**
   * Updates a rental expense
   */
  async updateRentalExpense(
    expenseId: string,
    updates: Partial<Omit<RentalExpense, 'id' | 'rental_id' | 'created_at' | 'updated_at'>>
  ): Promise<RentalExpense> {
    const { data, error } = await supabase
      .from('rental_expenses')
      .update(updates)
      .eq('id', expenseId)
      .select()
      .single();

    if (error) {
      console.error('Error updating rental expense:', error);
      throw error;
    }

    return data;
  },

  /**
   * Deletes a rental expense and its receipt file if it exists
   */
  async deleteRentalExpense(expenseId: string): Promise<void> {
    // Get expense info first to delete receipt file
    const { data: expense } = await supabase
      .from('rental_expenses')
      .select('receipt_url')
      .eq('id', expenseId)
      .single();

    if (expense?.receipt_url) {
      try {
        await this.deleteRentalExpenseReceipt(expense.receipt_url);
      } catch (error) {
        console.warn('Error deleting expense receipt file:', error);
      }
    }

    const { error } = await supabase
      .from('rental_expenses')
      .delete()
      .eq('id', expenseId);

    if (error) {
      console.error('Error deleting rental expense:', error);
      throw error;
    }
  },

  /**
   * Uploads a rental expense receipt
   */
  async uploadRentalExpenseReceipt(file: File, userId: string): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `rental-expense-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('rental-receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading rental expense receipt:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('rental-receipts')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error in uploadRentalExpenseReceipt:', error);
      throw error;
    }
  },

  /**
   * Deletes a rental expense receipt from storage
   */
  async deleteRentalExpenseReceipt(receiptUrl: string): Promise<void> {
    try {
      const urlParts = receiptUrl.split('/');
      const bucketIndex = urlParts.findIndex((part: string) => part === 'rental-receipts');
      if (bucketIndex === -1) {
        throw new Error('Invalid receipt URL format');
      }
      
      const filePath = urlParts.slice(bucketIndex + 1).join('/');

      const { error } = await supabase.storage
        .from('rental-receipts')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting rental expense receipt:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in deleteRentalExpenseReceipt:', error);
      throw error;
    }
  },

  /**
   * Adds payment receipts to a rental
   */
  async addReceiptsToRental(
    rentalId: string,
    receiptFiles: Array<{ file: File; amount?: number; payment_method?: string }>
  ): Promise<RentalReceipt[]> {
    const uploadPromises = receiptFiles.map(async ({ file, amount, payment_method }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `rental-${rentalId}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${rentalId}/${fileName}`;

      // Upload to storage
      const { data, error } = await supabase.storage
        .from('rental-receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading rental receipt:', error);
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('rental-receipts')
        .getPublicUrl(filePath);

      // Save receipt record
      const { data: receiptData, error: insertError } = await supabase
        .from('rental_receipts')
        .insert([{
          rental_id: rentalId,
          receipt_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          amount: amount || null,
          payment_method: payment_method || null,
          upload_date: new Date().toISOString(),
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error adding rental receipt record:', insertError);
        throw insertError;
      }

      return receiptData;
    });

    return Promise.all(uploadPromises);
  },

  /**
   * Deletes a rental receipt
   */
  async deleteRentalReceipt(receiptId: string): Promise<void> {
    // Get receipt info first
    const { data: receipt } = await supabase
      .from('rental_receipts')
      .select('receipt_url')
      .eq('id', receiptId)
      .single();

    if (receipt?.receipt_url) {
      try {
        const urlParts = receipt.receipt_url.split('/');
        const bucketIndex = urlParts.findIndex((part: string) => part === 'rental-receipts');
        if (bucketIndex !== -1) {
          const filePath = urlParts.slice(bucketIndex + 1).join('/');
          await supabase.storage
            .from('rental-receipts')
            .remove([filePath]);
        }
      } catch (error) {
        console.warn('Error deleting rental receipt file:', error);
      }
    }

    // Delete receipt record
    const { error } = await supabase
      .from('rental_receipts')
      .delete()
      .eq('id', receiptId);

    if (error) {
      console.error('Error deleting rental receipt:', error);
      throw error;
    }
  },

  /**
   * Get vehicles available for rental during a specific period
   */
  async getAvailableVehiclesForRental(
    startDate: string,
    endDate: string,
    excludeRentalId?: string
  ): Promise<{ id: string; plate: string }[]> {
    try {
      // Get all vehicles
      const { data: allVehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, plate')
        .order('plate');

      if (vehiclesError) {
        console.error('Error fetching vehicles:', vehiclesError);
        
        // Handle vehicles table not existing
        if (vehiclesError.message?.includes('relation') && vehiclesError.message?.includes('vehicles') && vehiclesError.message?.includes('does not exist')) {
          console.warn('Vehicles table does not exist yet. Please run the database migration.');
          return [];
        }
        
        throw vehiclesError;
      }

      // If rental tables don't exist yet, return all vehicles as available
      try {
        // Get rentals that overlap with the requested period
        let query = supabase
          .from('vehicle_rentals')
          .select(`
            id,
            rental_vehicles (vehicle_id)
          `)
          .neq('status', 'cancelled')
          .or(`and(rental_start_date.lte.${endDate},rental_end_date.gte.${startDate})`);

        // Exclude current rental if editing
        if (excludeRentalId) {
          query = query.neq('id', excludeRentalId);
        }

        const { data: overlappingRentals, error: rentalsError } = await query;

        if (rentalsError) {
          console.error('Error fetching overlapping rentals:', rentalsError);
          
          // If rental tables don't exist, return all vehicles as available
          if (rentalsError.message?.includes('relation') && rentalsError.message?.includes('does not exist')) {
            console.warn('Rental tables do not exist yet. Returning all vehicles as available.');
            return allVehicles || [];
          }
          
          throw rentalsError;
        }

        // Get vehicle IDs that are already rented during this period
        const rentedVehicleIds = new Set();
        overlappingRentals?.forEach(rental => {
          rental.rental_vehicles?.forEach(rv => {
            rentedVehicleIds.add(rv.vehicle_id);
          });
        });

        // Filter out rented vehicles
        const availableVehicles = (allVehicles || []).filter(
          vehicle => !rentedVehicleIds.has(vehicle.id)
        );

        return availableVehicles;
      } catch (rentalError: any) {
        // If rental tables don't exist, return all vehicles as available
        if (rentalError?.message?.includes('relation') && rentalError?.message?.includes('does not exist')) {
          console.warn('Rental tables do not exist yet. Returning all vehicles as available.');
          return allVehicles || [];
        }
        
        throw rentalError;
      }
    } catch (error: any) {
      console.error('Error in getAvailableVehiclesForRental:', error);
      
      // Handle any table not existing errors by returning empty array
      if (error?.message?.includes('relation') && error?.message?.includes('does not exist')) {
        console.warn('Required tables do not exist yet. Please run the database migrations.');
        return [];
      }
      
      throw error;
    }
  },

  /**
   * Get rental summary for a date range
   */
  async getRentalSummary(startDate: string, endDate: string): Promise<{
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    rental_count: number;
    vehicle_count: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('vehicle_rentals')
        .select(`
          rental_amount,
          rental_expenses (amount),
          rental_vehicles (vehicle_id)
        `)
        .gte('rental_start_date', startDate)
        .lte('rental_end_date', endDate)
        .neq('status', 'cancelled');

      if (error) {
        console.error('Error fetching rental summary:', error);
        
        // Handle table not existing yet
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          console.warn('Rental tables do not exist yet. Returning empty summary.');
          return {
            total_revenue: 0,
            total_expenses: 0,
            net_profit: 0,
            rental_count: 0,
            vehicle_count: 0
          };
        }
        
        throw error;
      }

      const rentals = data || [];
      const totalRevenue = rentals.reduce((sum, rental) => sum + rental.rental_amount, 0);
      const totalExpenses = rentals.reduce((sum, rental) => 
        sum + (rental.rental_expenses || []).reduce((expSum, exp) => expSum + exp.amount, 0), 0);
      
      const uniqueVehicles = new Set();
      rentals.forEach(rental => {
        rental.rental_vehicles?.forEach(rv => uniqueVehicles.add(rv.vehicle_id));
      });

      return {
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: totalRevenue - totalExpenses,
        rental_count: rentals.length,
        vehicle_count: uniqueVehicles.size
      };
    } catch (error: any) {
      console.error('Error in getRentalSummary:', error);
      
      // Handle any rental table not existing errors
      if (error?.message?.includes('relation') && error?.message?.includes('does not exist')) {
        console.warn('Rental tables do not exist yet. Returning empty summary.');
        return {
          total_revenue: 0,
          total_expenses: 0,
          net_profit: 0,
          rental_count: 0,
          vehicle_count: 0
        };
      }
      
      // Handle RLS permission errors
      if (error?.message?.includes('permission denied') || 
          error?.message?.includes('RLS') ||
          error?.message?.includes('policy')) {
        console.warn('RLS policies missing for rental tables. Returning empty summary.');
        return {
          total_revenue: 0,
          total_expenses: 0,
          net_profit: 0,
          rental_count: 0,
          vehicle_count: 0
        };
      }
      
      // As fallback, return empty summary to prevent crashes
      console.warn('🆘 Returning empty summary as fallback for rental error:', error);
      return {
        total_revenue: 0,
        total_expenses: 0,
        net_profit: 0,
        rental_count: 0,
        vehicle_count: 0
      };
    }
  }
};
