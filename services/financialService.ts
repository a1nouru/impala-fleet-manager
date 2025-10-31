import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// --- Type Definitions based on the new schema ---

export interface DailyReport {
  id: string;
  vehicle_id: string;
  report_date: string;
  route?: string;
  status: 'Operational' | 'Non-Operational';
  non_operational_reason?: string;
  ticket_revenue: number;
  baggage_revenue: number;
  cargo_revenue: number;
  explanation?: string; // Explanation for flagged reports (low net revenue or high expenses)
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined data from the 'vehicles' table
  vehicles?: {
    plate: string;
  };
  // We can add aggregated data later
  total_revenue?: number;
  total_expenses?: number;
  daily_expenses: DailyExpense[];
  // Add deposit status (optional since not always included)
  deposit_reports?: { deposit_id: string }[];
}

export interface DateAudit {
  id: string;
  audit_date: string;
  is_audited: boolean;
  audited_at: string;
  audited_by: string;
  created_at: string;
  updated_at: string;
}

export interface DailyExpense {
  id: string;
  report_id: string;
  category: string;
  description?: string;
  amount: number;
  receipt_url?: string; // URL to fuel receipt image
  created_at: string;
  updated_at: string;
}

export interface BankDepositSlip {
    id: string;
    deposit_id: string;
    slip_url: string;
    file_name?: string;
    file_size?: number;
    upload_date: string;
    created_by?: string;
}

export interface BankDeposit {
    id: string;
    bank_name: 'Caixa Angola' | 'BAI';
    deposit_date: string;
    amount: number;
    deposit_slip_url?: string; // Legacy field - kept for backward compatibility
    created_by?: string;
    created_at: string;
    updated_at: string;
    // Joined data
    deposit_reports?: { report_id: string }[];
    // New multiple slips support
    bank_deposit_slips?: BankDepositSlip[];
}

export interface CompanyExpenseReceipt {
    id: string;
    expense_id: string;
    receipt_url: string;
    file_name?: string;
    file_size?: number;
    upload_date: string;
    created_by?: string;
}

export interface CompanyExpense {
    id: string;
    expense_date: string;
    category: string;
    description?: string;
    amount: number;
    has_receipt: boolean;
    created_by?: string;
    created_at: string;
    updated_at: string;
    // Joined data for receipts
    company_expense_receipts?: CompanyExpenseReceipt[];
}

// --- Rental-related interfaces ---

export interface VehicleRental {
    id: string;
    rental_start_date: string;
    rental_end_date: string;
    rental_amount: number; // Revenue from rental
    client_name?: string;
    client_contact?: string;
    description?: string;
    status: 'active' | 'completed' | 'cancelled';
    created_by?: string;
    created_at: string;
    updated_at: string;
    // Joined data
    rental_vehicles?: RentalVehicle[];
    rental_expenses?: RentalExpense[];
    rental_receipts?: RentalReceipt[];
}

export interface RentalVehicle {
    id: string;
    rental_id: string;
    vehicle_id: string;
    created_at: string;
    // Joined data from the 'vehicles' table
    vehicles?: {
        plate: string;
    };
}

export interface RentalExpense {
    id: string;
    rental_id: string;
    category: string;
    description?: string;
    amount: number;
    expense_date: string;
    receipt_url?: string;
    created_at: string;
    updated_at: string;
}

export interface RentalReceipt {
    id: string;
    rental_id: string;
    receipt_url: string;
    file_name?: string;
    file_size?: number;
    amount?: number; // Payment amount for this receipt
    payment_method?: 'cash' | 'transfer' | 'cheque' | 'other';
    upload_date: string;
    created_by?: string;
}

// --- Service Functions ---

export const financialService = {
  /**
   * Fetches all daily reports, joining vehicle information for display.
   */
  async getDailyReports(): Promise<DailyReport[]> {
    const { data, error } = await supabase
      .from('daily_reports')
      .select(`
        *,
        vehicles (
          plate
        ),
        daily_expenses (*),
        deposit_reports (deposit_id)
      `)
      .order('report_date', { ascending: false });

    if (error) {
      console.error('Error fetching daily reports:', error);
      throw error;
    }

    // In the future, we can add logic here to fetch related expenses
    // and calculate total revenue/expenses for each report.
    return data || [];
  },

  /**
   * Creates a new daily report.
   * @param reportData - The data for the new report.
   */
  async createDailyReport(reportData: {
    vehicle_id: string;
    report_date: string;
    route?: string | null;
    status: 'Operational' | 'Non-Operational';
    non_operational_reason?: string | null;
    ticket_revenue: number;
    baggage_revenue: number;
    cargo_revenue: number;
    explanation?: string | null;
    created_by?: string;
  }): Promise<DailyReport> {
    // Remove explanation field if it's not provided to avoid database errors
    // until the migration is applied
    const { explanation, ...dataToInsert } = reportData;
    const insertData = explanation ? reportData : dataToInsert;
    
    const { data, error } = await supabase
      .from('daily_reports')
      .insert([insertData])
      .select(`
        *,
        vehicles (
          plate
        )
      `)
      .single();

    if (error) {
      console.error('Error creating daily report:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to create daily report: ${error.message || JSON.stringify(error)}`);
    }

    return data;
  },

  /**
   * Fetches a single daily report by its ID, including related expenses.
   * @param reportId - The UUID of the report to fetch.
   */
  async getDailyReportById(reportId: string): Promise<DailyReport | null> {
    const { data, error } = await supabase
      .from('daily_reports')
      .select(`
        *,
        vehicles (plate),
        daily_expenses (*)
      `)
      .eq('id', reportId)
      .single();

    if (error) {
      console.error('Error fetching daily report by ID:', error);
      throw error;
    }

    return data;
  },

  /**
   * Creates a new expense for a daily report.
   * @param expenseData - The data for the new expense.
   */
  async createDailyExpense(expenseData: Omit<DailyExpense, 'id' | 'created_at' | 'updated_at'>): Promise<DailyExpense> {
    // Normalize category
    let normalizedCategory = expenseData.category;
    if (typeof normalizedCategory === 'string') {
      if (normalizedCategory.trim().toLowerCase() === 'fuel') normalizedCategory = 'Fuel';
      else if (normalizedCategory.trim().toLowerCase() === 'subsidy') normalizedCategory = 'Subsidy';
    }
    const { data, error } = await supabase
      .from('daily_expenses')
      .insert([{ ...expenseData, category: normalizedCategory }])
      .select('*')
      .single();

    if (error) {
      console.error('Error creating daily expense:', error);
      throw error;
    }

    return data;
  },

  /**
   * Fetches all bank deposits with associated deposit report links and multiple slips.
   */
  async getBankDeposits(): Promise<BankDeposit[]> {
    const { data, error } = await supabase
      .from('bank_deposits')
      .select(`
        *,
        deposit_reports(report_id),
        bank_deposit_slips(*)
      `)
      .order('deposit_date', { ascending: false });

    if (error) {
      console.error('Error fetching bank deposits:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Fetches all operational reports that have not yet been deposited.
   */
  async getUndepositedReports(): Promise<DailyReport[]> {
    try {
      // Get all operational reports
      const { data: allReports, error: reportsError } = await supabase
        .from('daily_reports')
        .select(`
          *,
          vehicles (plate),
          daily_expenses (*)
        `)
        .eq('status', 'Operational')
        .order('report_date', { ascending: false });

      if (reportsError) {
        console.error('Error fetching all reports:', reportsError);
        throw reportsError;
      }

      // Get all deposited report IDs
      const { data: depositedReportIds, error: depositsError } = await supabase
        .from('deposit_reports')
        .select('report_id');

      if (depositsError) {
        console.error('Error fetching deposited report IDs:', depositsError);
        throw depositsError;
      }

      // Create a set of deposited report IDs for fast lookup
      const depositedIds = new Set((depositedReportIds || []).map(dr => dr.report_id));
      
      // Filter out reports that have been deposited
      return (allReports || []).filter(report => !depositedIds.has(report.id));
    } catch (error) {
      console.error('Error in getUndepositedReports:', error);
      throw error;
    }
  },

  /**
   * Fetches reports available for editing a specific deposit.
   * Includes reports not linked to any deposit + reports linked to the specified deposit.
   */
  async getReportsForEditingDeposit(depositId: string): Promise<DailyReport[]> {
    try {
      // Get all operational reports
      const { data: allReports, error: allReportsError } = await supabase
        .from('daily_reports')
        .select(`
          *,
          vehicles (plate),
          daily_expenses (*)
        `)
        .eq('status', 'Operational')
        .order('report_date', { ascending: false });

      if (allReportsError) {
        console.error('Error fetching all reports:', allReportsError);
        throw allReportsError;
      }

      // Get all deposit links
      const { data: allDepositLinks, error: linksError } = await supabase
        .from('deposit_reports')
        .select('report_id, deposit_id');

      if (linksError) {
        console.error('Error fetching deposit links:', linksError);
        throw linksError;
      }

      // Create a map of report_id -> deposit_id for quick lookup
      const reportDepositMap = new Map();
      (allDepositLinks || []).forEach(link => {
        reportDepositMap.set(link.report_id, link.deposit_id);
      });

      // Filter reports: include if undeposited OR linked to current deposit
      const availableReports = (allReports || []).filter(report => {
        const linkedDepositId = reportDepositMap.get(report.id);
        
        // Include if not linked to any deposit
        if (!linkedDepositId) return true;
        
        // Include if linked to the current deposit being edited
        if (linkedDepositId === depositId) return true;
        
        // Exclude if linked to a different deposit
        return false;
      });

      return availableReports;
    } catch (error) {
      console.error('Error in getReportsForEditingDeposit:', error);
      throw error;
    }
  },

  /**
   * Uploads a bank slip file to Supabase Storage
   * @param file - The file to upload (PDF or image)
   * @param depositId - The deposit ID to associate with the file
   */
  async uploadBankSlip(file: File, depositId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${depositId}-${Date.now()}.${fileExt}`;
    const filePath = `${depositId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('bank-slips')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading bank slip:', error);
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('bank-slips')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  /**
   * Creates a new bank deposit with multiple file upload support
   * @param depositData - The core data for the bank_deposits table.
   * @param reportIds - An array of report IDs to link in the deposit_reports table.
   * @param bankSlipFiles - Array of bank slip files to upload
   */
  async createBankDepositWithFile(
    depositData: Omit<BankDeposit, 'id' | 'created_at' | 'updated_at'>,
    reportIds: string[],
    bankSlipFiles?: File[]
  ): Promise<BankDeposit> {
    // First create the deposit to get the ID using the new function
    const { data: depositId, error } = await supabase.rpc('create_bank_deposit_with_multiple_reports', {
      p_bank_name: depositData.bank_name,
      p_deposit_date: depositData.deposit_date,
      p_amount: depositData.amount,
      p_report_ids: reportIds
    });

    if (error) {
      console.error('Error creating bank deposit:', error);
      throw error;
    }

    // Upload multiple files if provided
    if (bankSlipFiles && bankSlipFiles.length > 0) {
      try {
        await this.uploadMultipleBankSlips(bankSlipFiles, depositId);
      } catch (uploadError) {
        console.error('Error uploading bank slip files:', uploadError);
        // Don't throw here - deposit was created successfully
      }
    }

    // Fetch and return the complete deposit data with slips
    const { data: depositResult, error: fetchError } = await supabase
      .from('bank_deposits')
      .select(`
        *,
        deposit_reports(report_id),
        bank_deposit_slips(*)
      `)
      .eq('id', depositId)
      .single();

    if (fetchError) {
      console.error('Error fetching created deposit:', fetchError);
      throw fetchError;
    }

    return depositResult;
  },

  /**
   * Uploads multiple bank slip files for a deposit
   * @param files - Array of files to upload
   * @param depositId - The deposit ID to associate with the files
   */
  async uploadMultipleBankSlips(files: File[], depositId: string): Promise<BankDepositSlip[]> {
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${depositId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${depositId}/${fileName}`;

      // Upload to storage
      const { data, error } = await supabase.storage
        .from('bank-slips')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading bank slip:', error);
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('bank-slips')
        .getPublicUrl(filePath);

      // Add slip record to database
      const { data: slipId, error: slipError } = await supabase.rpc('add_slip_to_deposit', {
        p_deposit_id: depositId,
        p_slip_url: publicUrl,
        p_file_name: file.name,
        p_file_size: file.size
      });

      if (slipError) {
        console.error('Error adding slip record:', slipError);
        throw slipError;
      }

      return {
        id: slipId,
        deposit_id: depositId,
        slip_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        upload_date: new Date().toISOString(),
        created_by: undefined
      } as BankDepositSlip;
    });

    return Promise.all(uploadPromises);
  },

  /**
   * Adds additional slip files to an existing deposit
   * @param depositId - The deposit ID to add slips to
   * @param files - Array of files to upload
   */
  async addSlipsToDeposit(depositId: string, files: File[]): Promise<BankDepositSlip[]> {
    return this.uploadMultipleBankSlips(files, depositId);
  },

  /**
   * Deletes a specific bank slip
   * @param slipId - The ID of the slip to delete
   */
  async deleteBankSlip(slipId: string): Promise<void> {
    try {
      // Get slip info first to delete from storage
      const { data: slip, error: fetchError } = await supabase
        .from('bank_deposit_slips')
        .select('slip_url')
        .eq('id', slipId)
        .single();

      if (fetchError) {
        console.error('Error fetching slip for deletion:', fetchError);
        throw fetchError;
      }

      // Delete from storage if URL exists
      if (slip?.slip_url) {
        try {
          const url = new URL(slip.slip_url);
          const filePath = url.pathname.split('/bank-slips/')[1];
          
          if (filePath) {
            const { error: storageError } = await supabase.storage
              .from('bank-slips')
              .remove([filePath]);

            if (storageError) {
              console.error('Error deleting slip from storage:', storageError);
              // Don't throw here - continue with database deletion
            }
          }
        } catch (urlError) {
          console.error('Error parsing slip URL:', urlError);
          // Continue with database deletion
        }
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('bank_deposit_slips')
        .delete()
        .eq('id', slipId);

      if (deleteError) {
        console.error('Error deleting slip from database:', deleteError);
        throw deleteError;
      }
    } catch (error) {
      console.error('Error in deleteBankSlip:', error);
      throw error;
    }
  },



  /**
   * Creates a new bank deposit and links it to specified reports (without file upload).
   * @param depositData - The core data for the bank_deposits table.
   * @param reportIds - An array of report IDs to link in the deposit_reports table.
   */
  async createBankDeposit(
    depositData: Omit<BankDeposit, 'id' | 'created_at' | 'updated_at'>,
    reportIds: string[]
  ): Promise<BankDeposit> {
    return this.createBankDepositWithFile(depositData, reportIds);
  },

  /**
   * Fetches a financial summary over a given date range.
   * @param startDate - The start of the date range.
   * @param endDate - The end of the date range.
   */
  async getFinancialSummary(startDate: string, endDate: string): Promise<{ total_revenue: number; total_expenses: number; net_balance: number }> {
    const { data, error } = await supabase.rpc('get_financial_summary', {
      start_date: startDate,
      end_date: endDate,
    });

    if (error) {
      console.error('Error fetching financial summary:', error);
      throw error;
    }

    // The RPC returns an array with one object, so we return the first element.
    return data[0];
  },

  /**
   * Fetches data aggregated by month for the overview chart.
   * @param startDate - The start of the date range.
   * @param endDate - The end of the date range.
   */
  async getChartData(startDate: string, endDate: string): Promise<{ name: string; total: number }[]> {
    const { data, error } = await supabase.rpc('get_chart_data', {
      start_date: startDate,
      end_date: endDate,
    });

    if (error) {
      console.error('Error fetching chart data:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get recent deposits for display
   */
  async getRecentDeposits(): Promise<{ id: string; amount: number; created_by: string; created_at: string; }[]> {
    const { data, error } = await supabase
      .from('bank_deposits')
      .select('id, amount, created_by, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching recent deposits:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get revenue trend data for line/area charts
   */
  async getRevenueTrend(startDate: string, endDate: string): Promise<{ 
    date: string; 
    revenue: number; 
    expenses: number; 
    net: number;
    ticket_revenue: number;
    baggage_revenue: number;
    cargo_revenue: number;
  }[]> {
    const { data, error } = await supabase.rpc('get_revenue_trend', {
      start_date: startDate,
      end_date: endDate
    });

    if (error) {
      console.error('Error fetching revenue trend:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get expense breakdown by category for pie/doughnut charts
   */
  async getExpenseBreakdown(startDate: string, endDate: string): Promise<{
    category: string;
    amount: number;
    percentage: number;
    color: string;
  }[]> {
    const { data, error } = await supabase.rpc('get_expense_breakdown', {
      start_date: startDate,
      end_date: endDate
    });

    if (error) {
      console.error('Error fetching expense breakdown:', error);
      throw error;
    }

    // Add colors for each category
    const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];
    return (data || []).map((item: any, index: number) => ({
      ...item,
      color: colors[index % colors.length]
    }));
  },

  /**
   * Get vehicle performance comparison for bar charts
   */
  async getVehiclePerformance(startDate: string, endDate: string): Promise<{
    vehicle_plate: string;
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    operational_days: number;
    avg_daily_revenue: number;
  }[]> {
    const { data, error } = await supabase.rpc('get_vehicle_performance', {
      start_date: startDate,
      end_date: endDate
    });

    if (error) {
      console.error('Error fetching vehicle performance:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get revenue composition data for stacked charts
   */
  async getRevenueComposition(startDate: string, endDate: string): Promise<{
    date: string;
    ticket_revenue: number;
    baggage_revenue: number;
    cargo_revenue: number;
    total_revenue: number;
  }[]> {
    const { data, error } = await supabase.rpc('get_revenue_composition', {
      start_date: startDate,
      end_date: endDate
    });

    if (error) {
      console.error('Error fetching revenue composition:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get monthly comparison data for comparative analytics
   */
  async getMonthlyComparison(year: number): Promise<{
    month: string;
    current_year_revenue: number;
    previous_year_revenue: number;
    growth_percentage: number;
  }[]> {
    const { data, error } = await supabase.rpc('get_monthly_comparison', {
      target_year: year
    });

    if (error) {
      console.error('Error fetching monthly comparison:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get KPI metrics for dashboard cards
   */
  async getKPIMetrics(startDate: string, endDate: string): Promise<{
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    profit_margin: number;
    avg_daily_revenue: number;
    total_operational_days: number;
    best_performing_vehicle: string;
    revenue_growth: number;
  }> {
    const { data, error } = await supabase.rpc('get_kpi_metrics', {
      start_date: startDate,
      end_date: endDate
    });

    if (error) {
      console.error('Error fetching KPI metrics:', error);
      throw error;
    }

    return data || {
      total_revenue: 0,
      total_expenses: 0,
      net_profit: 0,
      profit_margin: 0,
      avg_daily_revenue: 0,
      total_operational_days: 0,
      best_performing_vehicle: 'N/A',
      revenue_growth: 0
    };
  },

  /**
   * Updates an existing bank deposit.
   * @param depositId - The ID of the deposit to update.
   * @param updateData - The data to update.
   * @param newReportIds - Optional new array of report IDs to link
   */
  async updateBankDeposit(
    depositId: string, 
    updateData: Partial<Pick<BankDeposit, 'bank_name' | 'deposit_date' | 'amount'>>,
    newReportIds?: string[]
  ): Promise<BankDeposit> {
    try {
      // Update the deposit basic info
      const { error: updateError } = await supabase
        .from('bank_deposits')
        .update(updateData)
        .eq('id', depositId);

      if (updateError) {
        console.error('Error updating deposit:', updateError);
        throw updateError;
      }

      // Update report links if provided
      if (newReportIds !== undefined) {
        // Remove all existing report links
        const { error: deleteError } = await supabase
          .from('deposit_reports')
          .delete()
          .eq('deposit_id', depositId);

        if (deleteError) {
          console.error('Error removing old report links:', deleteError);
          throw deleteError;
        }

        // Add new report links
        if (newReportIds.length > 0) {
          const newLinks = newReportIds.map(reportId => ({
            deposit_id: depositId,
            report_id: reportId
          }));

          const { error: insertError } = await supabase
            .from('deposit_reports')
            .insert(newLinks);

          if (insertError) {
            console.error('Error inserting new report links:', insertError);
            throw insertError;
          }
        }
      }

      // Fetch and return the updated deposit with slips
      const { data: updatedDeposit, error: fetchError } = await supabase
        .from('bank_deposits')
        .select(`
          *,
          deposit_reports(report_id),
          bank_deposit_slips(*)
        `)
        .eq('id', depositId)
        .single();

      if (fetchError) {
        console.error('Error fetching updated deposit:', fetchError);
        throw fetchError;
      }

      return updatedDeposit;
    } catch (error) {
      console.error('Error in updateBankDeposit:', error);
      throw error;
    }
  },

  /**
   * Updates an existing daily report.
   * @param reportId - The ID of the report to update.
   * @param reportData - The data to update.
   */
  async updateDailyReport(reportId: string, reportData: Partial<Omit<DailyReport, 'id' | 'created_at' | 'updated_at' | 'daily_expenses' | 'deposit_reports'>>): Promise<DailyReport> {
    const { data, error } = await supabase
      .from('daily_reports')
      .update(reportData)
      .eq('id', reportId)
      .select('*')
      .single();
    
    if (error) {
      console.error('Error updating daily report:', error);
      throw error;
    }
    return data;
  },

  /**
   * Updates an existing daily expense.
   * @param expenseId - The ID of the expense to update.
   * @param expenseData - The data to update.
   */
  async updateDailyExpense(expenseId: string, expenseData: Partial<Omit<DailyExpense, 'id' | 'report_id' | 'created_at' | 'updated_at'>>): Promise<DailyExpense> {
    // Normalize category
    let normalizedCategory = expenseData.category;
    if (typeof normalizedCategory === 'string') {
      if (normalizedCategory.trim().toLowerCase() === 'fuel') normalizedCategory = 'Fuel';
      else if (normalizedCategory.trim().toLowerCase() === 'subsidy') normalizedCategory = 'Subsidy';
    }
    const { data, error } = await supabase
      .from('daily_expenses')
      .update({ ...expenseData, category: normalizedCategory })
      .eq('id', expenseId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating daily expense:', error);
      throw error;
    }
    return data;
  },

  /**
   * Deletes a daily expense.
   * @param expenseId - The ID of the expense to delete.
   */
  async deleteDailyExpense(expenseId: string): Promise<void> {
    const { error } = await supabase
      .from('daily_expenses')
      .delete()
      .eq('id', expenseId);

    if (error) {
      console.error('Error deleting daily expense:', error);
      throw error;
    }
  },

  /**
   * Uploads a fuel receipt to Supabase storage
   * @param file - The file to upload (PDF or image)
   * @param userId - The user ID to organize files by user
   */
  async uploadFuelReceipt(file: File, userId: string): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('fuel-receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading fuel receipt:', error);
        throw error;
      }

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('fuel-receipts')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error in uploadFuelReceipt:', error);
      throw error;
    }
  },

  /**
   * Deletes a fuel receipt from Supabase storage
   * @param receiptUrl - The URL of the receipt to delete
   */
  async deleteFuelReceipt(receiptUrl: string): Promise<void> {
    try {
      // Extract the file path from the URL
      const urlParts = receiptUrl.split('/');
      const bucketIndex = urlParts.findIndex(part => part === 'fuel-receipts');
      if (bucketIndex === -1) {
        throw new Error('Invalid receipt URL format');
      }
      
      const filePath = urlParts.slice(bucketIndex + 1).join('/');

      const { error } = await supabase.storage
        .from('fuel-receipts')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting fuel receipt:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in deleteFuelReceipt:', error);
      throw error;
    }
  },

  /**
   * Deletes a bank deposit.
   * @param depositId - The ID of the deposit to delete.
   */
  async deleteBankDeposit(depositId: string): Promise<void> {
    const { data: deposit, error: fetchError } = await supabase
      .from('bank_deposits')
      .select('deposit_slip_url')
      .eq('id', depositId)
      .single();

    if (fetchError) {
      console.error('Error fetching deposit for deletion:', fetchError);
      throw new Error('Could not fetch deposit details before deletion.');
    }

    if (deposit?.deposit_slip_url) {
      const url = new URL(deposit.deposit_slip_url);
      const filePath = url.pathname.split('/bank-slips/')[1];
      
      const { error: storageError } = await supabase.storage
        .from('bank-slips')
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting bank slip from storage:', storageError);
      }
    }

    const { error: deleteError } = await supabase
      .from('bank_deposits')
      .delete()
      .eq('id', depositId);

    if (deleteError) {
      console.error('Error deleting bank deposit:', deleteError);
      throw new Error('Failed to delete bank deposit.');
    }
  },

  /**
   * Deletes a daily report and all its associated expenses.
   * @param reportId - The ID of the report to delete.
   */
  async deleteDailyReport(reportId: string): Promise<void> {
    // First check if this report is associated with any bank deposits
    const { data: depositReports, error: depositCheckError } = await supabase
      .from('deposit_reports')
      .select('deposit_id')
      .eq('report_id', reportId);

    if (depositCheckError) {
      console.error('Error checking deposit associations:', depositCheckError);
      throw new Error('Could not check if report is associated with deposits.');
    }

    if (depositReports && depositReports.length > 0) {
      throw new Error('Cannot delete report that is associated with bank deposits. Please remove it from deposits first.');
    }

    // Delete all expenses associated with this report first (due to foreign key constraints)
    const { error: expensesError } = await supabase
      .from('daily_expenses')
      .delete()
      .eq('report_id', reportId);

    if (expensesError) {
      console.error('Error deleting associated expenses:', expensesError);
      throw new Error('Failed to delete associated expenses.');
    }

    // Now delete the report itself
    const { error: deleteError } = await supabase
      .from('daily_reports')
      .delete()
      .eq('id', reportId);

    if (deleteError) {
      console.error('Error deleting daily report:', deleteError);
      throw new Error('Failed to delete daily report.');
    }
  },

  // --- Company Expense Functions ---

  /**
   * Fetches all company expenses with their receipts
   */
  async getCompanyExpenses(): Promise<CompanyExpense[]> {
    try {
      const { data, error } = await supabase
        .from('company_expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (error) {
        console.error('Error fetching company expenses:', error);
        
        // Check if it's a "table does not exist" error
        if (error.message?.includes('relation') && error.message?.includes('company_expenses') && error.message?.includes('does not exist')) {
          console.warn('Company expenses table does not exist yet. Please run the database migration.');
          return [];
        }
        
        // Check if it's a permissions/RLS error
        if (error.message?.includes('permission denied') || 
            error.message?.includes('RLS') ||
            error.message?.includes('policy') ||
            error.code === 'PGRST301') {
          console.warn('Row Level Security policies missing. Please run the RLS policies setup.');
          return [];
        }
        
        throw error;
      }

      // Get receipts for each expense
      const expenses = data || [];
      for (const expense of expenses) {
        try {
          const { data: receipts } = await supabase
            .from('company_expense_receipts')
            .select('*')
            .eq('expense_id', expense.id);
          expense.company_expense_receipts = receipts || [];
        } catch (receiptError) {
          console.warn('Could not load receipts for expense:', expense.id, receiptError);
          expense.company_expense_receipts = [];
        }
      }

      return expenses;
    } catch (error: any) {
      console.error('Caught error in getCompanyExpenses:', error);
      
      // Handle any other errors gracefully
      if (error?.message?.includes('relation') && error?.message?.includes('company_expenses') && error?.message?.includes('does not exist')) {
        console.warn('Company expenses table does not exist yet. Please run the database migration.');
        return [];
      }
      
      if (error?.message?.includes('permission denied') || 
          error?.message?.includes('RLS') ||
          error?.message?.includes('policy')) {
        console.warn('Row Level Security policies missing. Please run the RLS policies setup.');
        return [];
      }
      
      // As absolute last resort, return empty array to prevent page crash
      console.warn('Returning empty array as fallback for error:', error);
      return [];
    }
  },

  /**
   * Creates a new company expense
   */
  async createCompanyExpense(expenseData: {
    expense_date: string;
    category: string;
    description?: string;
    amount: number;
    has_receipt: boolean;
    created_by?: string;
  }): Promise<CompanyExpense> {
    const { data, error } = await supabase
      .from('company_expenses')
      .insert([expenseData])
      .select()
      .single();

    if (error) {
      console.error('Error creating company expense:', error);
      throw error;
    }

    return data;
  },

  /**
   * Creates a company expense with receipt files
   */
  async createCompanyExpenseWithReceipt(
    expenseData: {
      expense_date: string;
      category: string;
      description?: string;
      amount: number;
      has_receipt: boolean;
      created_by?: string;
    },
    receiptFiles: File[]
  ): Promise<CompanyExpense> {
    const expense = await this.createCompanyExpense(expenseData);
    
    if (receiptFiles.length > 0) {
      await this.addReceiptsToExpense(expense.id, receiptFiles);
    }

    return expense;
  },

  /**
   * Updates a company expense
   */
  async updateCompanyExpense(
    expenseId: string,
    updates: {
      expense_date?: string;
      category?: string;
      description?: string;
      amount?: number;
      has_receipt?: boolean;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('company_expenses')
      .update(updates)
      .eq('id', expenseId);

    if (error) {
      console.error('Error updating company expense:', error);
      throw error;
    }
  },

  /**
   * Deletes a company expense and its associated receipts
   */
  async deleteCompanyExpense(expenseId: string): Promise<void> {
    // First delete all receipts (files and records)
    const { data: receipts } = await supabase
      .from('company_expense_receipts')
      .select('receipt_url, id')
      .eq('expense_id', expenseId);

    if (receipts) {
      for (const receipt of receipts) {
        try {
          // Delete from storage
          const urlParts = receipt.receipt_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          await supabase.storage
            .from('company-expense-receipts')
            .remove([fileName]);
        } catch (error) {
          console.warn('Error deleting receipt file:', error);
        }
      }

      // Delete receipt records
      await supabase
        .from('company_expense_receipts')
        .delete()
        .eq('expense_id', expenseId);
    }

    // Delete the expense
    const { error } = await supabase
      .from('company_expenses')
      .delete()
      .eq('id', expenseId);

    if (error) {
      console.error('Error deleting company expense:', error);
      throw error;
    }
  },

  /**
   * Adds receipt files to an existing company expense
   */
  async addReceiptsToExpense(expenseId: string, receiptFiles: File[]): Promise<void> {
    const uploadPromises = receiptFiles.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${expenseId}_${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('company-expense-receipts')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('company-expense-receipts')
        .getPublicUrl(fileName);

      // Save receipt record
      const { error: insertError } = await supabase
        .from('company_expense_receipts')
        .insert([{
          expense_id: expenseId,
          receipt_url: publicUrlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
          upload_date: new Date().toISOString(),
        }]);

      if (insertError) throw insertError;
    });

    await Promise.all(uploadPromises);
  },

  /**
   * Deletes a specific receipt from a company expense
   */
  async deleteCompanyExpenseReceipt(receiptId: string): Promise<void> {
    // Get receipt info first
    const { data: receipt } = await supabase
      .from('company_expense_receipts')
      .select('receipt_url')
      .eq('id', receiptId)
      .single();

    if (receipt) {
      // Delete from storage
      try {
        const urlParts = receipt.receipt_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await supabase.storage
          .from('company-expense-receipts')
          .remove([fileName]);
      } catch (error) {
        console.warn('Error deleting receipt file:', error);
      }
    }

    // Delete receipt record
    const { error } = await supabase
      .from('company_expense_receipts')
      .delete()
      .eq('id', receiptId);

    if (error) {
      console.error('Error deleting company expense receipt:', error);
      throw error;
    }
  },

  /**
   * Searches company expenses by category for autocomplete
   */
  async searchCompanyExpenseCategories(searchTerm: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('company_expenses')
        .select('category')
        .ilike('category', `%${searchTerm}%`)
        .order('category');

      if (error) {
        // Check if it's a "table does not exist" error
        if (error.message?.includes('relation "company_expenses" does not exist') || 
            error.code === 'PGRST116' || 
            error.message?.includes('does not exist')) {
          console.warn('Company expenses table does not exist yet. Please run the database migration.');
          return [];
        }
        console.error('Error searching expense categories:', error);
        throw error;
      }

      // Return unique categories
      const uniqueCategories = [...new Set(data?.map(item => item.category) || [])];
      return uniqueCategories;
    } catch (error: any) {
      // Handle any other errors gracefully
      if (error.message?.includes('relation "company_expenses" does not exist') || 
          error.message?.includes('does not exist')) {
        console.warn('Company expenses table does not exist yet. Please run the database migration.');
        return [];
      }
      console.error('Error searching expense categories:', error);
      // Return empty array as fallback to prevent crashes
      console.warn('🆘 Returning empty search results as fallback');
      return [];
    }
  },

  /**
   * Gets all date audits
   */
  async getDateAudits(): Promise<DateAudit[]> {
    try {
      const { data, error } = await supabase
        .from('date_audits')
        .select('*')
        .order('audit_date', { ascending: false });

      if (error) {
        // If the table doesn't exist yet, return empty array
        if (error.message?.includes('relation "date_audits" does not exist') || 
            error.message?.includes('does not exist')) {
          console.warn('Date audits table does not exist yet. Please run the database migration.');
          return [];
        }
        console.error('Error fetching date audits:', error);
        throw error;
      }

      return data || [];
    } catch (error: any) {
      // Handle any other errors gracefully
      if (error.message?.includes('relation "date_audits" does not exist') || 
          error.message?.includes('does not exist')) {
        console.warn('Date audits table does not exist yet. Please run the database migration.');
        return [];
      }
      console.error('Error fetching date audits:', error);
      // Return empty array as fallback to prevent crashes
      console.warn('🆘 Returning empty date audits as fallback');
      return [];
    }
  },

  /**
   * Marks a date as audited or removes audit status
   * @param auditDate - The date to audit (YYYY-MM-DD format)
   * @param auditorId - The identifier of the auditor (user email or ID)
   * @param isAudited - Whether to mark as audited (true) or remove audit status (false)
   */
  async auditDate(auditDate: string, auditorId: string, isAudited: boolean = true): Promise<DateAudit | null> {
    // Authorization check - only giselemu007@gmail.com can audit
    if (auditorId !== 'giselemu007@gmail.com') {
      throw new Error('You are not authorized to perform audit actions. Only giselemu007@gmail.com can audit reports.');
    }
    
    try {
      if (isAudited) {
        // Insert or update the audit record
        const { data, error } = await supabase
          .from('date_audits')
          .upsert({
            audit_date: auditDate,
            audited_by: auditorId,
            is_audited: true
          })
          .select()
          .single();

        if (error) {
          if (error.message?.includes('relation "date_audits" does not exist')) {
            throw new Error('Date audits feature is not available. Please run the database migration first.');
          }
          console.error('Error marking date as audited:', error);
          throw new Error(`Failed to audit date: ${error.message}`);
        }

        return data;
      } else {
        // Remove the audit record
        const { error } = await supabase
          .from('date_audits')
          .delete()
          .eq('audit_date', auditDate);

        if (error) {
          if (error.message?.includes('relation "date_audits" does not exist')) {
            throw new Error('Date audits feature is not available. Please run the database migration first.');
          }
          console.error('Error removing audit status:', error);
          throw new Error(`Failed to remove audit from date: ${error.message}`);
        }

        return null;
      }
    } catch (error: any) {
      if (error.message?.includes('Date audits feature is not available')) {
        throw error;
      }
      if (error.message?.includes('relation "date_audits" does not exist')) {
        throw new Error('Date audits feature is not available. Please run the database migration first.');
      }
      throw error;
    }
  },

  /**
   * Check if a specific date is audited
   * @param auditDate - The date to check (YYYY-MM-DD format)
   */
  async isDateAudited(auditDate: string): Promise<DateAudit | null> {
    try {
      const { data, error } = await supabase
        .from('date_audits')
        .select('*')
        .eq('audit_date', auditDate)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        if (error.message?.includes('relation "date_audits" does not exist')) {
          console.warn('Date audits table does not exist yet. Please run the database migration.');
          return null;
        }
        console.error('Error checking date audit status:', error);
        throw error;
      }

      return data;
    } catch (error: any) {
      if (error.message?.includes('relation "date_audits" does not exist')) {
        console.warn('Date audits table does not exist yet. Please run the database migration.');
        return null;
      }
      console.error('Error checking date audit status:', error);
      return null; // Return null as fallback to prevent crashes
    }
  }
};

// Common routes for the fleet
export const COMMON_ROUTES = [
  'LUANDA - MBANZA',
  'MBANZA - LUANDA', 
  'LUANDA - HUAMBO',
  'HUAMBO - LUANDA',
  'LUVU - LUANDA',
  'LUANDA - LUVU',
  'MBANZA - HUAMBO',
  'HUAMBO - MBANZA',
  'CAXITO - LUANDA',
  'LUANDA - CAXITO',
  'UIGE - LUANDA',
  'LUANDA - UIGE',
  'BENGUELA - LUANDA',
  'LUANDA - BENGUELA',
  'URUBANO'
] as const; 