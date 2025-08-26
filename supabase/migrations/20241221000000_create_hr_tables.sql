-- Create HR module tables for employee management and damage tracking

-- Enable RLS
SET row_security = on;

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    referencia_transferencia TEXT DEFAULT 'PAGAMENTO',
    referencia_empresa TEXT DEFAULT 'ROYAL EXPRESS',
    morada_beneficiario TEXT DEFAULT 'LUANDA',
    iban_nib TEXT NOT NULL UNIQUE,
    valor DECIMAL(12,2) NOT NULL, -- Monthly salary in AOA
    moeda TEXT DEFAULT 'AKZ',
    tipo_despesas TEXT NOT NULL UNIQUE, -- e.g., OUR0040, OUR0041, etc.
    codigo_estatistico TEXT DEFAULT 'PAGAMENTO DE SALARIO',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vehicle_damages table
CREATE TABLE IF NOT EXISTS vehicle_damages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    damage_description TEXT NOT NULL,
    total_damage_cost DECIMAL(12,2) NOT NULL, -- Total cost of damage in AOA
    monthly_deduction_percentage INTEGER NOT NULL CHECK (monthly_deduction_percentage > 0 AND monthly_deduction_percentage <= 30), -- Max 30% per paycheck
    remaining_balance DECIMAL(12,2) NOT NULL, -- Amount still owed
    is_fully_paid BOOLEAN DEFAULT false,
    damage_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payroll_runs table  
CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_date DATE NOT NULL,
    payroll_month INTEGER NOT NULL CHECK (payroll_month >= 1 AND payroll_month <= 12),
    payroll_year INTEGER NOT NULL CHECK (payroll_year >= 2020),
    total_gross_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_net_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    employees_count INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(payroll_month, payroll_year)
);

-- Create payroll_deductions table
CREATE TABLE IF NOT EXISTS payroll_deductions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    vehicle_damage_id UUID REFERENCES vehicle_damages(id) ON DELETE SET NULL,
    gross_salary DECIMAL(12,2) NOT NULL,
    deduction_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_salary DECIMAL(12,2) NOT NULL,
    deduction_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(payroll_run_id, employee_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_tipo_despesas ON employees(tipo_despesas);
CREATE INDEX IF NOT EXISTS idx_vehicle_damages_employee ON vehicle_damages(employee_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_damages_vehicle ON vehicle_damages(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_damages_unpaid ON vehicle_damages(is_fully_paid) WHERE is_fully_paid = false;
CREATE INDEX IF NOT EXISTS idx_payroll_runs_month_year ON payroll_runs(payroll_year, payroll_month);
CREATE INDEX IF NOT EXISTS idx_payroll_deductions_payroll_run ON payroll_deductions(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_deductions_employee ON payroll_deductions(employee_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicle_damages_updated_at BEFORE UPDATE ON vehicle_damages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_runs_updated_at BEFORE UPDATE ON payroll_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS policies
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_deductions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for employees
CREATE POLICY "Enable read access for all users" ON employees FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON employees FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON employees FOR DELETE USING (true);

-- Create RLS policies for vehicle_damages
CREATE POLICY "Enable read access for all users" ON vehicle_damages FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON vehicle_damages FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON vehicle_damages FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON vehicle_damages FOR DELETE USING (true);

-- Create RLS policies for payroll_runs
CREATE POLICY "Enable read access for all users" ON payroll_runs FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON payroll_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON payroll_runs FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON payroll_runs FOR DELETE USING (true);

-- Create RLS policies for payroll_deductions
CREATE POLICY "Enable read access for all users" ON payroll_deductions FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON payroll_deductions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON payroll_deductions FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON payroll_deductions FOR DELETE USING (true);
