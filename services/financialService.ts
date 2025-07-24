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

export interface DailyExpense {
  id: string;
  report_id: string;
  category: string;
  description?: string;
  amount: number;
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
    created_by?: string;
  }): Promise<DailyReport> {
    const { data, error } = await supabase
      .from('daily_reports')
      .insert([reportData])
      .select(`
        *,
        vehicles (
          plate
        )
      `)
      .single();

    if (error) {
      console.error('Error creating daily report:', error);
      throw error;
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
  'LUANDA - UIGE'
] as const; 