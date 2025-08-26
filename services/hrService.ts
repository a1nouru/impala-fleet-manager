import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// Types
export interface Employee {
  id: string;
  nome: string;
  referencia_transferencia: string;
  referencia_empresa: string;
  morada_beneficiario: string;
  iban_nib: string;
  valor: number;
  moeda: string;
  tipo_despesas: string;
  codigo_estatistico: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VehicleDamage {
  id: string;
  employee_id: string;
  vehicle_id: string;
  damage_description: string;
  total_damage_cost: number;
  monthly_deduction_percentage: number;
  remaining_balance: number;
  is_fully_paid: boolean;
  damage_date: string;
  created_at: string;
  updated_at: string;
  employees?: Employee;
  vehicles?: {
    id: string;
    plate: string;
  };
}

export interface PayrollRun {
  id: string;
  run_date: string;
  payroll_month: number;
  payroll_year: number;
  total_gross_amount: number;
  total_deductions: number;
  total_net_amount: number;
  employees_count: number;
  status: 'draft' | 'finalized';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollDeduction {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  vehicle_damage_id?: string;
  gross_salary: number;
  deduction_amount: number;
  net_salary: number;
  deduction_reason?: string;
  created_at: string;
  employees?: Employee;
}

export interface DamageSummary {
  total_damages_value: number;
  total_deductions_this_month: number;
  active_damages_count: number;
  employees_with_damages_count: number;
}

class HRService {
  // Employee operations
  async getEmployees(): Promise<Employee[]> {
    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('nome');

      if (error) {
        console.error('Error fetching employees:', error);
        // Handle table doesn't exist error
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.warn('Employees table does not exist. Please run the HR migrations.');
          return [];
        }
        throw new Error(`Failed to fetch employees: ${error.message}`);
      }

      return data || [];
    } catch (err) {
      console.error('Unexpected error in getEmployees:', err);
      return [];
    }
  }

  async getActiveEmployees(): Promise<Employee[]> {
    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true)
        .order('nome');

      if (error) {
        console.error('Error fetching active employees:', error);
        // Handle table doesn't exist error
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.warn('Employees table does not exist. Please run the HR migrations.');
          return [];
        }
        throw new Error(`Failed to fetch active employees: ${error.message}`);
      }

      return data || [];
    } catch (err) {
      console.error('Unexpected error in getActiveEmployees:', err);
      return [];
    }
  }

  async createEmployee(employeeData: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .insert([employeeData])
      .select()
      .single();

    if (error) {
      console.error('Error creating employee:', error);
      throw new Error(`Failed to create employee: ${error.message}`);
    }

    return data;
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating employee:', error);
      throw new Error(`Failed to update employee: ${error.message}`);
    }

    return data;
  }

  // Vehicle Damage operations
  async getVehicleDamages(): Promise<VehicleDamage[]> {
    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await supabase
        .from('vehicle_damages')
        .select(`
          *,
          employees!employee_id(id, nome),
          vehicles!vehicle_id(id, plate)
        `)
        .order('damage_date', { ascending: false });

      if (error) {
        console.error('Error fetching vehicle damages:', error);
        // Handle table doesn't exist error
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.warn('Vehicle damages table does not exist. Please run the HR migrations.');
          return [];
        }
        throw new Error(`Failed to fetch vehicle damages: ${error.message}`);
      }

      return data || [];
    } catch (err) {
      console.error('Unexpected error in getVehicleDamages:', err);
      return [];
    }
  }

  async getUnpaidDamages(): Promise<VehicleDamage[]> {
    const { data, error } = await supabase
      .from('vehicle_damages')
      .select(`
        *,
        employees!employee_id(id, nome),
        vehicles!vehicle_id(id, plate)
      `)
      .eq('is_fully_paid', false)
      .gt('remaining_balance', 0)
      .order('damage_date', { ascending: false });

    if (error) {
      console.error('Error fetching unpaid damages:', error);
      throw new Error(`Failed to fetch unpaid damages: ${error.message}`);
    }

    return data || [];
  }

  async createVehicleDamage(damageData: Omit<VehicleDamage, 'id' | 'remaining_balance' | 'is_fully_paid' | 'created_at' | 'updated_at'>): Promise<VehicleDamage> {
    // Set remaining balance to total damage cost initially
    const damageWithBalance = {
      ...damageData,
      remaining_balance: damageData.total_damage_cost,
      is_fully_paid: false
    };

    const { data, error } = await supabase
      .from('vehicle_damages')
      .insert([damageWithBalance])
      .select(`
        *,
        employees!employee_id(id, nome),
        vehicles!vehicle_id(id, plate)
      `)
      .single();

    if (error) {
      console.error('Error creating vehicle damage:', error);
      throw new Error(`Failed to create vehicle damage: ${error.message}`);
    }

    return data;
  }

  async updateVehicleDamage(id: string, updates: Partial<VehicleDamage>): Promise<VehicleDamage> {
    const { data, error } = await supabase
      .from('vehicle_damages')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        employees!employee_id(id, nome),
        vehicles!vehicle_id(id, plate)
      `)
      .single();

    if (error) {
      console.error('Error updating vehicle damage:', error);
      throw new Error(`Failed to update vehicle damage: ${error.message}`);
    }

    return data;
  }

  async deleteVehicleDamage(id: string): Promise<void> {
    const { error } = await supabase
      .from('vehicle_damages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting vehicle damage:', error);
      throw new Error(`Failed to delete vehicle damage: ${error.message}`);
    }
  }

  // Payroll operations
  async getPayrollRuns(): Promise<PayrollRun[]> {
    const { data, error } = await supabase
      .from('payroll_runs')
      .select('*')
      .order('payroll_year', { ascending: false })
      .order('payroll_month', { ascending: false });

    if (error) {
      console.error('Error fetching payroll runs:', error);
      throw new Error(`Failed to fetch payroll runs: ${error.message}`);
    }

    return data || [];
  }

  async getPayrollRun(id: string): Promise<PayrollRun | null> {
    const { data, error } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching payroll run:', error);
      throw new Error(`Failed to fetch payroll run: ${error.message}`);
    }

    return data;
  }

  async createPayrollRun(payrollData: { 
    payroll_month: number; 
    payroll_year: number; 
    created_by?: string 
  }): Promise<PayrollRun> {
    const { data, error } = await supabase
      .from('payroll_runs')
      .insert([{
        ...payrollData,
        run_date: new Date().toISOString().split('T')[0],
        status: 'draft'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating payroll run:', error);
      throw new Error(`Failed to create payroll run: ${error.message}`);
    }

    return data;
  }

  async processPayrollDeductions(payrollRunId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('process_payroll_deductions', {
        p_payroll_run_id: payrollRunId
      });

      if (error) {
        console.error('Error processing payroll deductions:', error);
        // Provide a more helpful error message if the function doesn't exist
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          throw new Error('Database function process_payroll_deductions does not exist. Please run the HR migrations first.');
        }
        throw new Error(`Failed to process payroll deductions: ${error.message}`);
      }
    } catch (err) {
      console.error('Unexpected error in processPayrollDeductions:', err);
      throw err;
    }
  }

  async getPayrollDeductions(payrollRunId: string): Promise<PayrollDeduction[]> {
    const { data, error } = await supabase
      .from('payroll_deductions')
      .select(`
        *,
        employees!employee_id(id, nome)
      `)
      .eq('payroll_run_id', payrollRunId)
      .order('gross_salary', { ascending: false });

    if (error) {
      console.error('Error fetching payroll deductions:', error);
      throw new Error(`Failed to fetch payroll deductions: ${error.message}`);
    }

    return data || [];
  }

  async finalizePayrollRun(payrollRunId: string): Promise<PayrollRun> {
    const { data, error } = await supabase
      .from('payroll_runs')
      .update({ status: 'finalized' })
      .eq('id', payrollRunId)
      .select()
      .single();

    if (error) {
      console.error('Error finalizing payroll run:', error);
      throw new Error(`Failed to finalize payroll run: ${error.message}`);
    }

    return data;
  }

  async deletePayrollRun(payrollRunId: string): Promise<void> {
    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { error } = await supabase
        .from('payroll_runs')
        .delete()
        .eq('id', payrollRunId);

      if (error) {
        console.error('Error deleting payroll run:', error);
        throw new Error(`Failed to delete payroll run: ${error.message}`);
      }
    } catch (err) {
      console.error('Unexpected error in deletePayrollRun:', err);
      throw err;
    }
  }

  // Summary operations
  async getCurrentMonthDamageSummary(): Promise<DamageSummary> {
    try {
      const { data, error } = await supabase.rpc('get_current_month_damage_summary');

      if (error) {
        console.error('Error fetching damage summary:', error);
        // Return default values if the function doesn't exist yet
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.warn('Database function get_current_month_damage_summary does not exist. Please run the HR migrations.');
          return {
            total_damages_value: 0,
            total_deductions_this_month: 0,
            active_damages_count: 0,
            employees_with_damages_count: 0
          };
        }
        throw new Error(`Failed to fetch damage summary: ${error.message}`);
      }

      return data?.[0] || {
        total_damages_value: 0,
        total_deductions_this_month: 0,
        active_damages_count: 0,
        employees_with_damages_count: 0
      };
    } catch (err) {
      console.error('Unexpected error in getCurrentMonthDamageSummary:', err);
      return {
        total_damages_value: 0,
        total_deductions_this_month: 0,
        active_damages_count: 0,
        employees_with_damages_count: 0
      };
    }
  }

  // Calculate monthly deduction for an employee
  async calculateMonthlyDeduction(employeeId: string, month: number, year: number): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('calculate_monthly_deduction', {
        p_employee_id: employeeId,
        p_payroll_month: month,
        p_payroll_year: year
      });

      if (error) {
        console.error('Error calculating monthly deduction:', error);
        // Return 0 if the function doesn't exist yet
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.warn('Database function calculate_monthly_deduction does not exist. Please run the HR migrations.');
          return 0;
        }
        throw new Error(`Failed to calculate monthly deduction: ${error.message}`);
      }

      return data || 0;
    } catch (err) {
      console.error('Unexpected error in calculateMonthlyDeduction:', err);
      return 0;
    }
  }
}

export const hrService = new HRService();
